"""
FastAPI server for the face recognition model.

Run with:
    python -m mok.api.server
    # or
    uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
"""

import os
from typing import List, Optional, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from threading import Lock

from mok.pipeline.ml_controller import MLController


# Global model controller (loaded on startup)
_controller: Optional[MLController] = None
_training_lock = Lock()


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
    embedding: Union[List[float], List[List[float]]]
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
    return ModelStatusResponse(
        status="ready",
        model_name=controller.MODEL_NAME,
        input_shape=list(controller.INPUT_SHAPE),
        num_classes=controller.num_classes,
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
        
        if request.embedding and isinstance(request.embedding[0], list):
            raise HTTPException(
                status_code=400,
                detail="Prediction requires a single embedding array, not a list of embeddings",
            )
        # Convert embedding to numpy array and reshape for model
        embedding = np.array(request.embedding, dtype=np.float32)
        
        # Run prediction
        predicted_label, confidence = controller.predict_image(embedding)
        
        # Build response
        response = PredictionResponse(
            predicted_label=str(predicted_label),
            confidence=float(confidence),
        )
        
        # If user_id provided, add verification result
        if request.user_id:
            response.verified = (str(predicted_label) == request.user_id)
        
        return response
        
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
    
    result = await predict_embedding(request)
    return {
        "verified": result.verified,
        "confidence": result.confidence,
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
