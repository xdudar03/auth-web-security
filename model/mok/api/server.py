"""
FastAPI server for the face recognition model.

Run with:
    python -m mok.api.server
    # or
    uvicorn mok.api.server:app --host 0.0.0.0 --port 5000
"""

import os
import math
import time
from typing import List, Optional, Union
from contextlib import asynccontextmanager
import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from threading import Lock, Thread

from mok.pipeline.ml_controller import MLController


# Global model controller (loaded on startup)
_controller: Optional[MLController] = None
_training_lock = Lock()
_retrain_state_lock = Lock()
_retrain_dirty = False
_retrain_worker_running = False
_retrain_first_pending_at = 0.0
_retrain_last_request_at = 0.0
RETRAIN_DEBOUNCE_SECONDS = float(
    os.environ.get("MODEL_RETRAIN_DEBOUNCE_SECONDS", "10")
)
RETRAIN_MAX_WAIT_SECONDS = float(
    os.environ.get("MODEL_RETRAIN_MAX_WAIT_SECONDS", "60")
)
PREDICT_RETRY_ATTEMPTS = int(
    os.environ.get("MODEL_PREDICT_RETRY_ATTEMPTS", "3")
)
PREDICT_RETRY_DELAY_SECONDS = float(
    os.environ.get("MODEL_PREDICT_RETRY_DELAY_SECONDS", "0.1")
)
VERIFY_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_VERIFY_CONFIDENCE_THRESHOLD", "0.65")
)
VERIFY_MIN_ACCEPTED_FRAMES = int(
    os.environ.get("MODEL_VERIFY_MIN_ACCEPTED_FRAMES", "2")
)
VERIFY_MIN_ACCEPTED_RATIO = float(
    os.environ.get("MODEL_VERIFY_MIN_ACCEPTED_RATIO", "0.5")
)
VERIFY_STRONG_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_VERIFY_STRONG_CONFIDENCE_THRESHOLD", "0.9")
)
VERIFY_ALLOW_SINGLE_GOOD_FRAME = (
    os.environ.get("MODEL_VERIFY_ALLOW_SINGLE_GOOD_FRAME", "true").strip().lower()
    in {"1", "true", "yes", "on"}
)


def _decode_embedding_payload(embedding: Union[List[float], List[List[float]], str]):
    if isinstance(embedding, str):
        try:
            embedding = json.loads(embedding)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid embedding JSON string") from exc
    return embedding


def _predict_with_retry(
    controller: MLController,
    embedding,
    user_id: str = "",
):
    attempts = max(1, int(PREDICT_RETRY_ATTEMPTS))
    delay_seconds = max(0.0, float(PREDICT_RETRY_DELAY_SECONDS))
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return controller.predict_image(embedding, user_id=user_id)
        except Exception as error:
            last_error = error
            if attempt < attempts:
                time.sleep(delay_seconds)
    raise last_error


def _run_single_retrain(controller: MLController):
    with _training_lock:
        try:
            controller.retrain_from_db()
        except Exception as e:
            print(f"Retraining failed: {e}")


def _retrain_worker_loop(controller: MLController):
    global _retrain_dirty, _retrain_worker_running
    global _retrain_first_pending_at, _retrain_last_request_at
    while True:
        with _retrain_state_lock:
            # Nothing pending: stop worker. A future request will start a new one.
            if not _retrain_dirty:
                _retrain_worker_running = False
                return

            first_pending_at = _retrain_first_pending_at
            last_request_at = _retrain_last_request_at

        # Batch short bursts, but enforce a hard upper bound on wait time.
        now = time.monotonic()
        until_debounce_ready = max(
            0.0,
            RETRAIN_DEBOUNCE_SECONDS - (now - last_request_at),
        )
        until_max_wait = max(
            0.0,
            RETRAIN_MAX_WAIT_SECONDS - (now - first_pending_at),
        )
        sleep_seconds = min(until_debounce_ready, until_max_wait)
        if sleep_seconds > 0.0:
            time.sleep(min(sleep_seconds, 1.0))
            continue

        with _retrain_state_lock:
            if not _retrain_dirty:
                continue
            # Consume current pending signal and run exactly one retrain.
            _retrain_dirty = False
            _retrain_first_pending_at = 0.0
            _retrain_last_request_at = 0.0
        _run_single_retrain(controller)


def request_retrain(controller: MLController):
    global _retrain_dirty, _retrain_worker_running
    global _retrain_first_pending_at, _retrain_last_request_at
    now = time.monotonic()
    should_start_worker = False
    with _retrain_state_lock:
        if not _retrain_dirty:
            _retrain_first_pending_at = now
        _retrain_last_request_at = now
        _retrain_dirty = True
        if not _retrain_worker_running:
            _retrain_worker_running = True
            should_start_worker = True
    if should_start_worker:
        Thread(
            target=_retrain_worker_loop,
            args=(controller,),
            daemon=True,
        ).start()


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
        predicted_label, confidence = _predict_with_retry(
            controller,
            embedding,
            user_id=request.user_id or "",
        )
        
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
        predicted_label, confidence = _predict_with_retry(
            controller,
            embedding,
            user_id=request.user_id,
        )
        guessed_label, guessed_confidence = _predict_with_retry(controller, embedding)
        is_match = (
            str(predicted_label) == request.user_id
            and str(predicted_label) != "unknown"
            and float(confidence) >= VERIFY_CONFIDENCE_THRESHOLD
        )
        frame_results.append(
            (
                is_match,
                float(confidence),
                str(guessed_label),
                float(guessed_confidence),
            )
        )

    total_frames = len(frame_results)
    accepted_frames = sum(1 for is_match, _, _, _ in frame_results if is_match)
    strong_matches = sum(
        1
        for is_match, conf, _, _ in frame_results
        if is_match and conf >= VERIFY_STRONG_CONFIDENCE_THRESHOLD
    )
    ratio_required = max(1, math.ceil(total_frames * VERIFY_MIN_ACCEPTED_RATIO))
    min_required = max(1, min(VERIFY_MIN_ACCEPTED_FRAMES, total_frames))
    required_votes = max(min_required, ratio_required)
    best_claimed_confidence = max((conf for _, conf, _, _ in frame_results), default=0.0)
    single_good_frame_verified = (
        VERIFY_ALLOW_SINGLE_GOOD_FRAME
        and accepted_frames >= 1
        and best_claimed_confidence >= VERIFY_CONFIDENCE_THRESHOLD
    )
    verified = (
        (accepted_frames >= required_votes)
        or (strong_matches >= 1)
        or single_good_frame_verified
    )

    confidence = best_claimed_confidence
    guessed_scores = {}
    for _, _, guessed_label, guessed_confidence in frame_results:
        guessed_scores[guessed_label] = guessed_scores.get(guessed_label, 0.0) + guessed_confidence
    if guessed_scores:
        predicted_user_id = max(guessed_scores.items(), key=lambda item: item[1])[0]
    else:
        predicted_user_id = "unknown"
    predicted_user_confidence = max(
        (conf for _, _, label, conf in frame_results if label == predicted_user_id),
        default=0.0,
    )

    return {
        "verified": verified,
        "confidence": confidence,
        "user_id": request.user_id,
        "predicted_user_id": predicted_user_id,
        "predicted_user_confidence": predicted_user_confidence,
    }


@app.post("/add_embedding")
async def add_embedding(request: EmbeddingRequest):
    """
    Add a new embedding to the database and request model retraining.
    """
    controller = get_controller()
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required for adding an embedding")
    if request.embedding is None or len(request.embedding) == 0:
        raise HTTPException(status_code=400, detail="embedding is required for adding an embedding")
    controller.add_embedding(request.user_id, request.embedding)
    request_retrain(controller)
    return {"message": "Embedding added; retraining scheduled"}


@app.post("/initial_training")
async def initial_training():
    """
    Initial model training using embeddings already in the DB.
    """
    controller = get_controller()
    print(f"Controller: {controller}")
    print(f"Getting embedding count: {controller.get_embedding_count()}")
    print(f"Database path: {controller._db_path}")
    if controller.get_embedding_count() == 0:
        raise HTTPException(status_code=400, detail="No embeddings found in DB for training")
    request_retrain(controller)
    return {"message": "Initial training scheduled from DB embeddings"}

# ============== Main ==============

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
