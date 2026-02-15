"""
FastAPI server for the face recognition model.

Run with:
    python -m mok.api.server
    # or
    uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
"""

import os
import math
from typing import List, Optional, Union
from contextlib import asynccontextmanager
import json

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from threading import Lock

from mok.pipeline.ml_controller import MLController


# Global model controller (loaded on startup)
_controller: Optional[MLController] = None
_training_lock = Lock()
VERIFY_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_VERIFY_CONFIDENCE_THRESHOLD", "0.85")
)
VERIFY_MIN_ACCEPTED_FRAMES = int(
    os.environ.get("MODEL_VERIFY_MIN_ACCEPTED_FRAMES", "3")
)
VERIFY_MIN_ACCEPTED_RATIO = float(
    os.environ.get("MODEL_VERIFY_MIN_ACCEPTED_RATIO", "0.6")
)


def _decode_embedding_payload(embedding: Union[List[float], List[List[float]], str]):
    if isinstance(embedding, str):
        try:
            embedding = json.loads(embedding)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid embedding JSON string") from exc
    return embedding


def retrain_model_task(controller: MLController):
    with _training_lock:
        try:
            controller.retrain_from_db()
        except Exception as e:
            print(f"Retraining failed: {e}")


def get_controller() -> MLController:
    """Get the loaded model controller."""
    global _controller
    if _controller is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return _controller


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global _controller
    try:
        print("Loading model...")
        _controller = MLController()
        print("Model loaded successfully")
    except Exception as e:
        print(f"Warning: Could not load model on startup: {e}")
        _controller = None
    yield
    # Cleanup on shutdown
    _controller = None


app = FastAPI(
    title="Face Recognition Model API",
    description="API for privacy-preserving face recognition",
    version="1.0.0",
    lifespan=lifespan,
)


# ============== Request/Response Models ==============

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


class EmbeddingRequest(BaseModel):
    """Request with face embedding for recognition."""
    embedding: Union[List[float], List[List[float]], str]
    user_id: Optional[str] = None  # Optional: for verification mode


class PredictionResponse(BaseModel):
    """Face recognition prediction result."""
    predicted_label: str
    confidence: float
    verified: Optional[bool] = None  # For verification mode


class ModelStatusResponse(BaseModel):
    status: str
    model_name: str
    input_shape: List[int]
    num_classes: Optional[int] = None
    is_training: bool


# ============== Endpoints ==============

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Basic health check."""
    return HealthResponse(
        status="ok",
        model_loaded=_controller is not None
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        model_loaded=_controller is not None
    )


@app.get("/status", response_model=ModelStatusResponse)
async def model_status():
    """Get model status and configuration."""
    controller = get_controller()
    is_training = _training_lock.locked()
    return ModelStatusResponse(
        status="training" if is_training else "ready",
        model_name=controller.MODEL_NAME,
        input_shape=list(controller.INPUT_SHAPE),
        num_classes=controller.num_classes,
        is_training=is_training,
    )


@app.post("/predict", response_model=PredictionResponse)
async def predict_embedding(request: EmbeddingRequest):
    """
    Predict identity from face embedding.
    
    If user_id is provided, returns verification result (verified: true/false).
    Otherwise returns the predicted identity.
    """
    controller = get_controller()
    
    try:
        import numpy as np

        decoded_embedding = _decode_embedding_payload(request.embedding)
        if not decoded_embedding:
            raise HTTPException(status_code=400, detail="Embedding is required")
        if decoded_embedding and isinstance(decoded_embedding[0], list):
            raise HTTPException(
                status_code=400,
                detail="Prediction requires a single embedding array, not a list of embeddings",
            )
        # Convert embedding to numpy array and reshape for model
        embedding = np.array(decoded_embedding, dtype=np.float32)
        
        # Run prediction
        predicted_label, confidence = controller.predict_image(embedding)
        
        # Build response
        response = PredictionResponse(
            predicted_label=str(predicted_label),
            confidence=float(confidence),
        )
        
        # If user_id provided, add verification result
        if request.user_id:
            response.verified = (
                str(predicted_label) == request.user_id
                and str(predicted_label) != "unknown"
                and float(confidence) >= VERIFY_CONFIDENCE_THRESHOLD
            )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/verify")
async def verify_identity(request: EmbeddingRequest):
    """
    Verify if embedding matches a specific user.
    Requires user_id in request.
    """
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required for verification")
    
    import numpy as np

    controller = get_controller()
    if _training_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Model is training. Please try biometric authentication again in a moment.",
        )
    raw_embedding = _decode_embedding_payload(request.embedding)
    if not raw_embedding:
        raise HTTPException(status_code=400, detail="Embedding is required for verification")
    if raw_embedding and isinstance(raw_embedding[0], list):
        embedding_batch = raw_embedding
    else:
        embedding_batch = [raw_embedding]

    frame_results = []
    for embedding_item in embedding_batch:
        embedding = np.array(embedding_item, dtype=np.float32)
        predicted_label, confidence = controller.predict_image(embedding)
        is_match = (
            str(predicted_label) == request.user_id
            and str(predicted_label) != "unknown"
            and float(confidence) >= VERIFY_CONFIDENCE_THRESHOLD
        )
        frame_results.append((is_match, float(confidence)))

    total_frames = len(frame_results)
    accepted_frames = sum(1 for is_match, _ in frame_results if is_match)
    ratio_required = max(1, math.ceil(total_frames * VERIFY_MIN_ACCEPTED_RATIO))
    min_required = max(1, min(VERIFY_MIN_ACCEPTED_FRAMES, total_frames))
    required_votes = max(min_required, ratio_required)
    verified = accepted_frames >= required_votes
    confidence = max((conf for is_match, conf in frame_results if is_match), default=0.0)

    return {
        "verified": verified,
        "confidence": confidence,
        "user_id": request.user_id,
    }


@app.post("/add_embedding")
async def add_embedding(request: EmbeddingRequest, background_tasks: BackgroundTasks):
    """
    Add a new embedding to the database and re-train the model.
    """
    controller = get_controller()
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required for adding an embedding")
    if request.embedding is None or len(request.embedding) == 0:
        raise HTTPException(status_code=400, detail="embedding is required for adding an embedding")
    controller.add_embedding(request.user_id, request.embedding)
    background_tasks.add_task(retrain_model_task, controller)
    return {"message": "Embedding added; retraining started"}


@app.post("/initial_training")
async def initial_training(background_tasks: BackgroundTasks):
    """
    Initial model training using embeddings already in the DB.
    """
    controller = get_controller()
    print(f"Controller: {controller}")
    print(f"Getting embedding count: {controller.get_embedding_count()}")
    print(f"Database path: {controller._db_path}")
    if controller.get_embedding_count() == 0:
        raise HTTPException(status_code=400, detail="No embeddings found in DB for training")
    background_tasks.add_task(retrain_model_task, controller)
    return {"message": "Initial training started from DB embeddings"}

# ============== Main ==============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
