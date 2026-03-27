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
from typing import Any, Dict, List, Optional, Union
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
_metrics_lock = Lock()
_retrain_dirty = False
_retrain_worker_running = False
_retrain_first_pending_at = 0.0
_retrain_last_request_at = 0.0
_retrain_pending_updates = 0
_verify_last_request_at = 0.0
_predict_total = 0
_predict_unknown = 0
_verify_total = 0
_verify_verified = 0
RETRAIN_DEBOUNCE_SECONDS = float(
    os.environ.get("MODEL_RETRAIN_DEBOUNCE_SECONDS", "10")
)
RETRAIN_MAX_WAIT_SECONDS = float(
    os.environ.get("MODEL_RETRAIN_MAX_WAIT_SECONDS", "60")
)
RETRAIN_MIN_PENDING_UPDATES = int(
    os.environ.get("MODEL_RETRAIN_MIN_PENDING_UPDATES", "5")
)
RETRAIN_QUIET_PERIOD_SECONDS = float(
    os.environ.get("MODEL_RETRAIN_QUIET_PERIOD_SECONDS", "20")
)
PREDICT_RETRY_ATTEMPTS = int(
    os.environ.get("MODEL_PREDICT_RETRY_ATTEMPTS", "3")
)
PREDICT_RETRY_DELAY_SECONDS = float(
    os.environ.get("MODEL_PREDICT_RETRY_DELAY_SECONDS", "0.1")
)
VERIFY_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_VERIFY_CONFIDENCE_THRESHOLD", "0.60")
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
PREDICT_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_PREDICT_CONFIDENCE_THRESHOLD", "0.50")
)
PREDICT_MIN_ACCEPTED_FRAMES = int(
    os.environ.get("MODEL_PREDICT_MIN_ACCEPTED_FRAMES", "1")
)
PREDICT_MIN_ACCEPTED_RATIO = float(
    os.environ.get("MODEL_PREDICT_MIN_ACCEPTED_RATIO", "0.34")
)
PREDICT_STRONG_CONFIDENCE_THRESHOLD = float(
    os.environ.get("MODEL_PREDICT_STRONG_CONFIDENCE_THRESHOLD", "0.75")
)
PREDICT_ALLOW_SINGLE_GOOD_FRAME = (
    os.environ.get("MODEL_PREDICT_ALLOW_SINGLE_GOOD_FRAME", "true").strip().lower()
    in {"1", "true", "yes", "on"}
)
TIMING_LOGS_ENABLED = (
    os.environ.get("MODEL_TIMING_LOGS", "true").strip().lower()
    in {"1", "true", "yes", "on"}
)


def _timing_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000.0, 2)


def _log_timing(event: str, **metrics) -> None:
    if not TIMING_LOGS_ENABLED:
        return
    metrics_text = " ".join([f"{key}={value}" for key, value in metrics.items()])
    print(f"[timing][{event}] {metrics_text}".strip())


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
):
    attempts = max(1, int(PREDICT_RETRY_ATTEMPTS))
    delay_seconds = max(0.0, float(PREDICT_RETRY_DELAY_SECONDS))
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return controller.predict_image_details(embedding)
        except Exception as error:
            last_error = error
            if attempt < attempts:
                time.sleep(delay_seconds)
    if last_error is None:
        raise RuntimeError("Prediction failed without a captured exception")
    raise last_error


def _verify_with_retry(
    controller: MLController,
    embedding,
    user_id: str,
):
    attempts = max(1, int(PREDICT_RETRY_ATTEMPTS))
    delay_seconds = max(0.0, float(PREDICT_RETRY_DELAY_SECONDS))
    last_error = None
    for attempt in range(1, attempts + 1):
        attempt_started_at = time.perf_counter()
        try:
            result = controller.verify_image(embedding, user_id)
            _log_timing(
                "verify_frame_attempt",
                attempt=attempt,
                user_id=user_id,
                elapsed_ms=_timing_ms(attempt_started_at),
            )
            return result
        except Exception as error:
            last_error = error
            _log_timing(
                "verify_frame_attempt_failed",
                attempt=attempt,
                user_id=user_id,
                elapsed_ms=_timing_ms(attempt_started_at),
                error_type=type(error).__name__,
            )
            if attempt < attempts:
                time.sleep(delay_seconds)
    if last_error is None:
        raise RuntimeError("Verification failed without a captured exception")
    raise last_error


def _run_single_retrain(controller: MLController):
    with _training_lock:
        try:
            controller.retrain_from_db()
        except Exception as e:
            print(f"Retraining failed: {e}")


def _record_predict_outcome(predicted_label: str) -> float:
    global _predict_total, _predict_unknown
    with _metrics_lock:
        _predict_total += 1
        if str(predicted_label) == "unknown":
            _predict_unknown += 1
        return float(_predict_unknown / max(1, _predict_total))


def _record_verify_outcome(verified: bool) -> float:
    global _verify_total, _verify_verified
    with _metrics_lock:
        _verify_total += 1
        if verified:
            _verify_verified += 1
        return float(_verify_verified / max(1, _verify_total))


def _retrain_worker_loop(controller: MLController):
    global _retrain_dirty, _retrain_worker_running
    global _retrain_first_pending_at, _retrain_last_request_at
    global _retrain_pending_updates, _verify_last_request_at
    while True:
        with _retrain_state_lock:
            # Nothing pending: stop worker. A future request will start a new one.
            if not _retrain_dirty:
                _retrain_worker_running = False
                return

            first_pending_at = _retrain_first_pending_at
            last_request_at = _retrain_last_request_at
            pending_updates = _retrain_pending_updates
            last_verify_at = _verify_last_request_at

        # Batch short bursts, but enforce a hard upper bound on wait time.
        now = time.monotonic()
        until_debounce_ready = max(
            0.0,
            RETRAIN_DEBOUNCE_SECONDS - (now - last_request_at),
        )
        until_quiet_ready = max(
            0.0,
            RETRAIN_QUIET_PERIOD_SECONDS - (now - last_verify_at),
        )
        until_max_wait = max(
            0.0,
            RETRAIN_MAX_WAIT_SECONDS - (now - first_pending_at),
        )
        has_enough_updates = pending_updates >= max(1, RETRAIN_MIN_PENDING_UPDATES)
        max_wait_elapsed = until_max_wait <= 0.0

        # Start retraining early only when we have enough batched updates and
        # there has been a recent quiet window in verification traffic.
        # Always force retrain once max wait is exceeded.
        if not max_wait_elapsed and not has_enough_updates:
            sleep_seconds = min(max(until_debounce_ready, 1.0), max(until_max_wait, 0.0))
        elif not max_wait_elapsed:
            sleep_seconds = min(
                max(until_debounce_ready, until_quiet_ready, 0.0),
                max(until_max_wait, 0.0),
            )
        else:
            sleep_seconds = 0.0

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
            _retrain_pending_updates = 0
        _run_single_retrain(controller)


def request_retrain(controller: MLController, update_count: int = 1):
    global _retrain_dirty, _retrain_worker_running
    global _retrain_first_pending_at, _retrain_last_request_at
    global _retrain_pending_updates
    now = time.monotonic()
    should_start_worker = False
    with _retrain_state_lock:
        if not _retrain_dirty:
            _retrain_first_pending_at = now
        _retrain_last_request_at = now
        _retrain_dirty = True
        _retrain_pending_updates += max(1, int(update_count))
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
    decision: Optional[str] = None
    best_score: Optional[float] = None
    second_score: Optional[float] = None
    tau_abs: Optional[float] = None
    tau_margin: Optional[float] = None
    top_k: Optional[List[Dict[str, Any]]] = None
    unknown_rate: Optional[float] = None


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
    Returns the predicted identity and confidence.
    """
    controller = get_controller()
    
    try:
        import numpy as np

        raw_embedding = _decode_embedding_payload(request.embedding)
        if not raw_embedding:
            raise HTTPException(status_code=400, detail="Embedding is required")
        if raw_embedding and isinstance(raw_embedding[0], list):
            embedding_batch = raw_embedding
        else:
            embedding_batch = [raw_embedding]

        frame_results = []
        for embedding_item in embedding_batch:
            embedding = np.array(embedding_item, dtype=np.float32)
            details = _predict_with_retry(controller, embedding)
            frame_results.append(details)

        guessed_scores = {}
        for details in frame_results:
            guessed_label = str(details.get("predicted_label", "unknown"))
            guessed_confidence = float(details.get("confidence", 0.0))
            guessed_scores[guessed_label] = guessed_scores.get(guessed_label, 0.0) + guessed_confidence

        if guessed_scores:
            predicted_label = max(guessed_scores.items(), key=lambda item: item[1])[0]
        else:
            predicted_label = "unknown"

        predicted_confidence = max(
            (
                float(details.get("confidence", 0.0))
                for details in frame_results
                if str(details.get("predicted_label", "unknown")) == predicted_label
            ),
            default=0.0,
        )

        total_frames = len(frame_results)
        accepted_frames = sum(
            1
            for details in frame_results
            if str(details.get("predicted_label", "unknown")) == predicted_label
            and str(details.get("predicted_label", "unknown")) != "unknown"
            and float(details.get("confidence", 0.0)) >= PREDICT_CONFIDENCE_THRESHOLD
        )
        strong_matches = sum(
            1
            for details in frame_results
            if str(details.get("predicted_label", "unknown")) == predicted_label
            and str(details.get("predicted_label", "unknown")) != "unknown"
            and float(details.get("confidence", 0.0)) >= PREDICT_STRONG_CONFIDENCE_THRESHOLD
        )
        ratio_required = max(1, math.ceil(total_frames * PREDICT_MIN_ACCEPTED_RATIO))
        min_required = max(1, min(PREDICT_MIN_ACCEPTED_FRAMES, total_frames))
        required_votes = max(min_required, ratio_required)
        single_good_frame_verified = (
            PREDICT_ALLOW_SINGLE_GOOD_FRAME
            and accepted_frames >= 1
            and predicted_confidence >= PREDICT_CONFIDENCE_THRESHOLD
        )
        is_consistent_prediction = (
            (accepted_frames >= required_votes)
            or (strong_matches >= 1)
            or single_good_frame_verified
        )

        if not is_consistent_prediction:
            predicted_label = "unknown"
            predicted_confidence = 0.0

        unknown_rate = _record_predict_outcome(predicted_label)

        representative = None
        for details in frame_results:
            if str(details.get("predicted_label", "unknown")) == predicted_label:
                representative = details
                break
        if representative is None and frame_results:
            representative = frame_results[0]

        response = PredictionResponse(
            predicted_label=str(predicted_label),
            confidence=float(predicted_confidence),
            decision=(
                "inconsistent_frames"
                if not is_consistent_prediction
                else (representative.get("decision") if representative else None)
            ),
            best_score=(float(representative.get("best_score", 0.0)) if representative else None),
            second_score=(float(representative.get("second_score", 0.0)) if representative else None),
            tau_abs=(float(representative.get("tau_abs", 0.0)) if representative else None),
            tau_margin=(float(representative.get("tau_margin", 0.0)) if representative else None),
            top_k=(representative.get("top_k") if representative else None),
            unknown_rate=float(unknown_rate),
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
    global _verify_last_request_at
    total_started_at = time.perf_counter()
    _verify_last_request_at = time.monotonic()

    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required for verification")
    
    import numpy as np

    controller = get_controller()
    stage_started_at = time.perf_counter()
    raw_embedding = _decode_embedding_payload(request.embedding)
    if not raw_embedding:
        raise HTTPException(status_code=400, detail="Embedding is required for verification")
    if raw_embedding and isinstance(raw_embedding[0], list):
        embedding_batch = raw_embedding
    else:
        embedding_batch = [raw_embedding]
    decode_ms = _timing_ms(stage_started_at)

    frame_results = []
    frame_durations_ms = []
    for embedding_item in embedding_batch:
        frame_started_at = time.perf_counter()
        embedding = np.array(embedding_item, dtype=np.float32)
        verify_details = _verify_with_retry(
            controller,
            embedding,
            request.user_id,
        )
        frame_durations_ms.append(_timing_ms(frame_started_at))
        confidence = float(verify_details.get("confidence", 0.0))
        threshold = float(verify_details.get("threshold", VERIFY_CONFIDENCE_THRESHOLD))
        margin_to_impostor = float(verify_details.get("margin_to_impostor", 0.0))
        margin_threshold = float(verify_details.get("margin_threshold", 0.0))
        decision = str(verify_details.get("decision", "unknown"))
        impostor_best_score = float(verify_details.get("impostor_best_score", 0.0))
        impostor_best_centroid_score = float(
            verify_details.get("impostor_best_centroid_score", 0.0)
        )
        is_match = bool(verify_details.get("verified", False))
        frame_results.append(
            {
                "is_match": is_match,
                "confidence": float(confidence),
                "threshold": threshold,
                "margin_to_impostor": margin_to_impostor,
                "margin_threshold": margin_threshold,
                "decision": decision,
                "impostor_best_score": impostor_best_score,
                "impostor_best_centroid_score": impostor_best_centroid_score,
            }
        )

    total_frames = len(frame_results)
    accepted_frames = sum(1 for frame in frame_results if frame["is_match"])
    strong_matches = sum(
        1
        for frame in frame_results
        if frame["is_match"] and frame["confidence"] >= VERIFY_STRONG_CONFIDENCE_THRESHOLD
    )
    ratio_required = max(1, math.ceil(total_frames * VERIFY_MIN_ACCEPTED_RATIO))
    min_required = max(1, min(VERIFY_MIN_ACCEPTED_FRAMES, total_frames))
    required_votes = max(min_required, ratio_required)
    best_claimed_confidence = max((frame["confidence"] for frame in frame_results), default=0.0)
    best_threshold = min((frame["threshold"] for frame in frame_results), default=VERIFY_CONFIDENCE_THRESHOLD)
    representative_frame = max(frame_results, key=lambda frame: frame["confidence"], default=None)
    single_good_frame_verified = (
        VERIFY_ALLOW_SINGLE_GOOD_FRAME
        and accepted_frames >= 1
        and best_claimed_confidence >= best_threshold
    )
    verified = (
        (accepted_frames >= required_votes)
        or (strong_matches >= 1)
        or single_good_frame_verified
    )

    confidence = best_claimed_confidence
    predicted_user_id = request.user_id if verified else "unknown"
    predicted_user_confidence = confidence if verified else 0.0
    stage_started_at = time.perf_counter()
    verify_accept_rate = _record_verify_outcome(verified)
    metrics_ms = _timing_ms(stage_started_at)

    frames_total_ms = round(sum(frame_durations_ms), 2)
    frames_avg_ms = round(frames_total_ms / max(1, len(frame_durations_ms)), 2)
    frames_max_ms = round(max(frame_durations_ms, default=0.0), 2)
    _log_timing(
        "verify_endpoint",
        user_id=request.user_id,
        frames=len(embedding_batch),
        verified=bool(verified),
        decode_ms=decode_ms,
        frames_total_ms=frames_total_ms,
        frame_avg_ms=frames_avg_ms,
        frame_max_ms=frames_max_ms,
        aggregate_ms=metrics_ms,
        total_ms=_timing_ms(total_started_at),
    )

    return {
        "verified": verified,
        "confidence": confidence,
        "user_id": request.user_id,
        "predicted_user_id": predicted_user_id,
        "predicted_user_confidence": predicted_user_confidence,
        "verify_threshold": float(best_threshold),
        "verify_margin": float(representative_frame["margin_to_impostor"]) if representative_frame else 0.0,
        "verify_margin_threshold": float(representative_frame["margin_threshold"]) if representative_frame else 0.0,
        "verify_decision": str(representative_frame["decision"]) if representative_frame else "unknown",
        "verify_impostor_best_score": float(representative_frame["impostor_best_score"]) if representative_frame else 0.0,
        "verify_impostor_best_centroid_score": (
            float(representative_frame["impostor_best_centroid_score"])
            if representative_frame
            else 0.0
        ),
        "verify_accept_rate": verify_accept_rate,
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
    request_retrain(controller, update_count=1)
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
