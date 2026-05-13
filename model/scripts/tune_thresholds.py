#!/usr/bin/env python3
"""
Offline biometric threshold tuner.

This script is intentionally read-only by default. It reads stored embeddings,
builds an enrollment/probe split in memory, evaluates candidate verification
and prediction thresholds, and prints recommended environment variables.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sqlite3
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np


SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_DIR = SCRIPT_DIR.parent
REPO_ROOT = MODEL_DIR.parent
DEFAULT_DB_PATH = REPO_ROOT / "server" / "data" / "users.db"


DEFAULTS = {
    "MODEL_OPENSET_TAU_ABS": 0.8480,
    "MODEL_OPENSET_TAU_MARGIN": 0.0607,
    "MODEL_VERIFY_COSINE_THRESHOLD": 0.52,
    "MODEL_VERIFY_COSINE_MARGIN": 0.008,
    "MODEL_VERIFY_TOP_M_MIN_SCORE": 0.50,
    "MODEL_VERIFY_CENTROID_MIN_SCORE": 0.50,
    "MODEL_VERIFY_TEMPLATE_DOMINANCE_MARGIN": 0.005,
    "MODEL_VERIFY_CENTROID_DOMINANCE_MARGIN": 0.01,
}


@dataclass(frozen=True)
class VerificationSample:
    fused_score: float
    margin_to_impostor: float
    top_m_mean: float
    centroid_score: float
    template_margin_to_impostor: float
    centroid_margin_to_impostor: float
    is_genuine: bool


@dataclass(frozen=True)
class PredictionSample:
    best_score: float
    margin: float
    predicted_label: str
    expected_label: str
    is_known: bool


@dataclass(frozen=True)
class Metrics:
    false_accept_rate: float
    false_reject_rate: float
    true_accept_rate: float
    accuracy: float
    accepted: int
    rejected: int
    total: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Recommend biometric prediction/verification threshold env vars "
            "without changing app code or model artifacts."
        )
    )
    parser.add_argument(
        "--db-path",
        default=str(DEFAULT_DB_PATH),
        help="Path to SQLite database containing user_embeddings.",
    )
    parser.add_argument(
        "--output",
        help="Optional JSON report path. If omitted, no files are written.",
    )
    parser.add_argument(
        "--target-far",
        type=float,
        default=0.03,
        help="Target maximum false accept rate for recommendations.",
    )
    parser.add_argument(
        "--probe-ratio",
        type=float,
        default=0.35,
        help="Fraction of each known subject's embeddings used for probes.",
    )
    parser.add_argument(
        "--unknown-subject-ratio",
        type=float,
        default=0.2,
        help="Fraction of subjects held out as unknown for prediction tuning.",
    )
    parser.add_argument(
        "--max-impostor-pairs",
        type=int,
        default=20000,
        help="Maximum sampled impostor verification pairs.",
    )
    parser.add_argument(
        "--top-m",
        type=int,
        default=3,
        help="Top-M templates used in score aggregation.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic splits and impostor sampling.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full report as JSON instead of a human summary.",
    )
    parser.add_argument(
        "--allow-weaker-thresholds",
        action="store_true",
        help=(
            "Allow recommendations below current defaults. By default the tuner "
            "only recommends thresholds/margins at least as strict as current app defaults."
        ),
    )
    parser.add_argument(
        "--prediction-mode",
        choices=("holdout", "replay", "both"),
        default="both",
        help=(
            "Prediction evaluation mode. 'holdout' calibrates unknown rejection; "
            "'replay' mirrors shop/demo behavior by scoring all stored embeddings "
            "against all stored enrollment templates; 'both' reports both views."
        ),
    )
    return parser.parse_args()


def parse_embedding_payload(raw_value: str, subject_id: str) -> list[np.ndarray]:
    try:
        decoded = json.loads(raw_value)
    except Exception:
        decoded = raw_value

    if not isinstance(decoded, list):
        raise ValueError(
            f"Invalid embedding payload for subject_id={subject_id}: "
            f"expected list, got {type(decoded).__name__}"
        )

    parsed_vectors: list[np.ndarray] = []
    if decoded and all(isinstance(item, (int, float)) for item in decoded):
        parsed_vectors.append(np.asarray(decoded, dtype=np.float32))
    elif decoded and all(isinstance(item, (list, tuple)) for item in decoded):
        for item in decoded:
            if not all(isinstance(val, (int, float)) for val in item):
                raise ValueError(f"Non-numeric embedding values for subject_id={subject_id}")
            parsed_vectors.append(np.asarray(item, dtype=np.float32))
    else:
        raise ValueError(f"Invalid embedding format for subject_id={subject_id}")

    return parsed_vectors


def load_embeddings(db_path: Path) -> dict[str, list[np.ndarray]]:
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    uri = f"file:{db_path.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        rows = connection.execute(
            """
            SELECT COALESCE(userId, customerId) AS subjectId, embedding
            FROM user_embeddings
            WHERE COALESCE(userId, customerId) IS NOT NULL
            """
        ).fetchall()
    finally:
        connection.close()

    grouped: dict[str, list[np.ndarray]] = {}
    for subject_id, raw_embedding in rows:
        vectors = parse_embedding_payload(str(raw_embedding), str(subject_id))
        grouped.setdefault(str(subject_id), []).extend(vectors)

    if not grouped:
        raise RuntimeError(f"No embeddings found in {db_path}")

    dimensions = {int(vector.shape[0]) for vectors in grouped.values() for vector in vectors}
    if len(dimensions) != 1:
        raise RuntimeError(f"Expected one embedding dimension, found: {sorted(dimensions)}")

    return grouped


def normalize_vector(vector: np.ndarray) -> np.ndarray:
    vector = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(vector))
    if norm <= 1e-12:
        return vector
    return vector / norm


def normalize_rows(vectors: list[np.ndarray]) -> np.ndarray:
    matrix = np.vstack([normalize_vector(vector) for vector in vectors]).astype(np.float32)
    return matrix


def split_subjects(
    grouped: dict[str, list[np.ndarray]],
    probe_ratio: float,
    unknown_subject_ratio: float,
    rng: random.Random,
) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray], dict[str, np.ndarray]]:
    eligible = {
        subject_id: list(vectors)
        for subject_id, vectors in grouped.items()
        if len(vectors) >= 2
    }
    if len(eligible) < 2:
        raise RuntimeError("At least two subjects with two embeddings each are required.")

    subject_ids = sorted(eligible)
    rng.shuffle(subject_ids)

    unknown_count = 0
    if len(subject_ids) >= 5 and unknown_subject_ratio > 0:
        unknown_count = max(1, int(round(len(subject_ids) * unknown_subject_ratio)))
        unknown_count = min(unknown_count, len(subject_ids) - 2)

    unknown_ids = set(subject_ids[:unknown_count])
    known_ids = [subject_id for subject_id in subject_ids if subject_id not in unknown_ids]

    enrollment: dict[str, np.ndarray] = {}
    probes: dict[str, np.ndarray] = {}
    unknown: dict[str, np.ndarray] = {}

    for subject_id in known_ids:
        vectors = list(eligible[subject_id])
        rng.shuffle(vectors)
        probe_count = max(1, int(round(len(vectors) * probe_ratio)))
        probe_count = min(probe_count, len(vectors) - 1)
        probes[subject_id] = normalize_rows(vectors[:probe_count])
        enrollment[subject_id] = normalize_rows(vectors[probe_count:])

    for subject_id in sorted(unknown_ids):
        unknown[subject_id] = normalize_rows(eligible[subject_id])

    return enrollment, probes, unknown


def all_subject_vectors(grouped: dict[str, list[np.ndarray]]) -> dict[str, np.ndarray]:
    eligible = {
        subject_id: vectors
        for subject_id, vectors in grouped.items()
        if len(vectors) >= 1
    }
    if len(eligible) < 2:
        raise RuntimeError("At least two subjects with embeddings are required.")
    return {
        subject_id: normalize_rows(vectors)
        for subject_id, vectors in sorted(eligible.items())
    }


def centroid(vectors: np.ndarray) -> np.ndarray:
    value = np.mean(vectors, axis=0)
    norm = float(np.linalg.norm(value))
    if norm <= 1e-12:
        return value.astype(np.float32)
    return (value / norm).astype(np.float32)


def build_centroids(enrollment: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    return {subject_id: centroid(vectors) for subject_id, vectors in enrollment.items()}


def score_claim(
    query: np.ndarray,
    claimed_id: str,
    enrollment: dict[str, np.ndarray],
    centroids: dict[str, np.ndarray],
    top_m: int,
) -> VerificationSample:
    claimed_vectors = enrollment[claimed_id]
    scores = np.asarray(claimed_vectors @ query, dtype=np.float32)
    sorted_scores = np.sort(scores)[::-1]

    best_score = float(sorted_scores[0])
    top_count = max(1, min(int(top_m), len(sorted_scores)))
    top_m_mean = float(np.mean(sorted_scores[:top_count]))
    centroid_score = float(np.dot(centroids[claimed_id], query))
    fused_score = float(0.20 * best_score + 0.30 * top_m_mean + 0.50 * centroid_score)

    impostor_best = -1.0
    impostor_best_centroid = -1.0
    for subject_id, vectors in enrollment.items():
        if subject_id == claimed_id:
            continue
        subject_best = float(np.max(vectors @ query))
        impostor_best = max(impostor_best, subject_best)
        centroid_score_for_subject = float(np.dot(centroids[subject_id], query))
        impostor_best_centroid = max(impostor_best_centroid, centroid_score_for_subject)

    effective_impostor = impostor_best_centroid if impostor_best_centroid >= 0.0 else impostor_best
    margin_to_impostor = fused_score - effective_impostor if effective_impostor >= 0.0 else 1.0
    template_margin_to_impostor = best_score - impostor_best if impostor_best >= 0.0 else 1.0
    centroid_margin_to_impostor = (
        centroid_score - impostor_best_centroid if impostor_best_centroid >= 0.0 else 1.0
    )

    return VerificationSample(
        fused_score=float(fused_score),
        margin_to_impostor=float(margin_to_impostor),
        top_m_mean=float(top_m_mean),
        centroid_score=float(centroid_score),
        template_margin_to_impostor=float(template_margin_to_impostor),
        centroid_margin_to_impostor=float(centroid_margin_to_impostor),
        is_genuine=False,
    )


def collect_verification_samples(
    enrollment: dict[str, np.ndarray],
    probes: dict[str, np.ndarray],
    centroids: dict[str, np.ndarray],
    top_m: int,
    max_impostor_pairs: int,
    rng: random.Random,
) -> list[VerificationSample]:
    samples: list[VerificationSample] = []
    subject_ids = sorted(enrollment)

    genuine_queries: list[tuple[str, np.ndarray]] = []
    for subject_id, query_vectors in probes.items():
        for query in query_vectors:
            genuine_queries.append((subject_id, query))
            genuine = score_claim(query, subject_id, enrollment, centroids, top_m)
            samples.append(
                VerificationSample(
                    **{**asdict(genuine), "is_genuine": True},
                )
            )

    impostor_pairs: list[tuple[str, np.ndarray]] = []
    for true_id, query in genuine_queries:
        for claimed_id in subject_ids:
            if claimed_id != true_id:
                impostor_pairs.append((claimed_id, query))

    rng.shuffle(impostor_pairs)
    for claimed_id, query in impostor_pairs[:max(0, max_impostor_pairs)]:
        samples.append(score_claim(query, claimed_id, enrollment, centroids, top_m))

    return samples


def predict_query(
    query: np.ndarray,
    expected_label: str,
    is_known: bool,
    enrollment: dict[str, np.ndarray],
    centroids: dict[str, np.ndarray],
    top_m: int,
) -> PredictionSample:
    ranked: list[tuple[str, float]] = []
    for subject_id, vectors in enrollment.items():
        scores = np.sort(np.asarray(vectors @ query, dtype=np.float32))[::-1]
        top_count = max(1, min(int(top_m), len(scores)))
        template_score = float(0.70 * scores[0] + 0.30 * np.mean(scores[:top_count]))
        centroid_score = float(np.dot(centroids[subject_id], query))
        merged_score = float(0.55 * template_score + 0.45 * centroid_score)
        ranked.append((subject_id, merged_score))

    ranked.sort(key=lambda item: item[1], reverse=True)
    best_label, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else -1.0

    return PredictionSample(
        best_score=float(best_score),
        margin=float(best_score - second_score),
        predicted_label=best_label,
        expected_label=expected_label,
        is_known=is_known,
    )


def collect_prediction_samples(
    enrollment: dict[str, np.ndarray],
    probes: dict[str, np.ndarray],
    unknown: dict[str, np.ndarray],
    centroids: dict[str, np.ndarray],
    top_m: int,
) -> list[PredictionSample]:
    samples: list[PredictionSample] = []
    for subject_id, query_vectors in probes.items():
        for query in query_vectors:
            samples.append(
                predict_query(query, subject_id, True, enrollment, centroids, top_m)
            )

    for subject_id, query_vectors in unknown.items():
        for query in query_vectors:
            samples.append(
                predict_query(query, subject_id, False, enrollment, centroids, top_m)
            )

    return samples


def evaluate_verification(
    samples: list[VerificationSample],
    threshold: float,
    margin: float,
) -> Metrics:
    accepted = 0
    false_accepts = 0
    false_rejects = 0
    genuine_total = 0
    impostor_total = 0

    for sample in samples:
        is_accepted = (
            sample.fused_score >= threshold
            and sample.margin_to_impostor >= margin
            and sample.top_m_mean >= DEFAULTS["MODEL_VERIFY_TOP_M_MIN_SCORE"]
            and sample.centroid_score >= DEFAULTS["MODEL_VERIFY_CENTROID_MIN_SCORE"]
            and sample.template_margin_to_impostor
            >= DEFAULTS["MODEL_VERIFY_TEMPLATE_DOMINANCE_MARGIN"]
            and sample.centroid_margin_to_impostor
            >= DEFAULTS["MODEL_VERIFY_CENTROID_DOMINANCE_MARGIN"]
        )
        accepted += int(is_accepted)
        if sample.is_genuine:
            genuine_total += 1
            false_rejects += int(not is_accepted)
        else:
            impostor_total += 1
            false_accepts += int(is_accepted)

    total = len(samples)
    false_accept_rate = false_accepts / impostor_total if impostor_total else 0.0
    false_reject_rate = false_rejects / genuine_total if genuine_total else 0.0
    true_accept_rate = 1.0 - false_reject_rate
    accuracy = (total - false_accepts - false_rejects) / total if total else 0.0
    return Metrics(
        false_accept_rate=false_accept_rate,
        false_reject_rate=false_reject_rate,
        true_accept_rate=true_accept_rate,
        accuracy=accuracy,
        accepted=accepted,
        rejected=total - accepted,
        total=total,
    )


def evaluate_prediction(
    samples: list[PredictionSample],
    tau_abs: float,
    tau_margin: float,
) -> Metrics:
    accepted = 0
    false_accepts = 0
    false_rejects = 0
    known_total = 0
    unknown_total = 0
    correct = 0

    for sample in samples:
        is_accepted = sample.best_score >= tau_abs and sample.margin >= tau_margin
        accepted += int(is_accepted)
        if sample.is_known:
            known_total += 1
            is_correct_accept = is_accepted and sample.predicted_label == sample.expected_label
            correct += int(is_correct_accept)
            false_rejects += int(not is_correct_accept)
        else:
            unknown_total += 1
            correct += int(not is_accepted)
            false_accepts += int(is_accepted)

    total = len(samples)
    false_accept_rate = false_accepts / unknown_total if unknown_total else 0.0
    false_reject_rate = false_rejects / known_total if known_total else 0.0
    true_accept_rate = 1.0 - false_reject_rate
    accuracy = correct / total if total else 0.0
    return Metrics(
        false_accept_rate=false_accept_rate,
        false_reject_rate=false_reject_rate,
        true_accept_rate=true_accept_rate,
        accuracy=accuracy,
        accepted=accepted,
        rejected=total - accepted,
        total=total,
    )


def prediction_diagnostics(
    samples: list[PredictionSample],
    tau_abs: float,
    tau_margin: float,
) -> dict[str, Any]:
    known_total = 0
    unknown_total = 0
    known_top1_correct = 0
    known_accepted_correct = 0
    known_accepted_wrong = 0
    known_rejected_by_abs = 0
    known_rejected_by_margin = 0
    known_wrong_top1 = 0
    unknown_accepted = 0
    unknown_rejected = 0

    known_scores: list[float] = []
    known_margins: list[float] = []
    unknown_scores: list[float] = []
    unknown_margins: list[float] = []

    for sample in samples:
        passes_abs = sample.best_score >= tau_abs
        passes_margin = sample.margin >= tau_margin
        is_accepted = passes_abs and passes_margin

        if sample.is_known:
            known_total += 1
            known_scores.append(sample.best_score)
            known_margins.append(sample.margin)
            is_top1_correct = sample.predicted_label == sample.expected_label
            known_top1_correct += int(is_top1_correct)
            known_wrong_top1 += int(not is_top1_correct)
            if is_accepted and is_top1_correct:
                known_accepted_correct += 1
            elif is_accepted:
                known_accepted_wrong += 1
            elif not passes_abs:
                known_rejected_by_abs += 1
            elif not passes_margin:
                known_rejected_by_margin += 1
        else:
            unknown_total += 1
            unknown_scores.append(sample.best_score)
            unknown_margins.append(sample.margin)
            unknown_accepted += int(is_accepted)
            unknown_rejected += int(not is_accepted)

    def describe(values: list[float]) -> dict[str, float | None]:
        if not values:
            return {"min": None, "p50": None, "p90": None, "max": None}
        return {
            "min": float(np.min(values)),
            "p50": float(np.percentile(values, 50)),
            "p90": float(np.percentile(values, 90)),
            "max": float(np.max(values)),
        }

    return {
        "tau_abs": float(tau_abs),
        "tau_margin": float(tau_margin),
        "known_total": known_total,
        "unknown_total": unknown_total,
        "known_top1_accuracy_before_threshold": (
            known_top1_correct / known_total if known_total else 0.0
        ),
        "known_accept_correct_rate": (
            known_accepted_correct / known_total if known_total else 0.0
        ),
        "known_accepted_correct": known_accepted_correct,
        "known_accepted_wrong": known_accepted_wrong,
        "known_wrong_top1": known_wrong_top1,
        "known_rejected_by_abs": known_rejected_by_abs,
        "known_rejected_by_margin": known_rejected_by_margin,
        "unknown_accepted": unknown_accepted,
        "unknown_rejected": unknown_rejected,
        "known_score_summary": describe(known_scores),
        "known_margin_summary": describe(known_margins),
        "unknown_score_summary": describe(unknown_scores),
        "unknown_margin_summary": describe(unknown_margins),
    }


def candidate_values(
    values: list[float],
    fallback: float,
    padding: float = 0.02,
    min_value: float = -1.0,
    max_value: float = 1.0,
) -> list[float]:
    if not values:
        return [fallback]
    percentiles = np.percentile(values, [1, 5, 10, 25, 50, 75, 90, 95, 99])
    candidates = {
        round(float(min(max(value, min_value), max_value)), 4)
        for value in percentiles
    }
    candidates.add(round(float(min(max(fallback, min_value), max_value)), 4))
    candidates.add(round(float(max(min_value, min(values) - padding)), 4))
    candidates.add(round(float(min(max_value, max(values) + padding)), 4))
    return sorted(candidates)


def choose_best(
    evaluations: list[dict[str, Any]],
    target_far: float,
) -> dict[str, Any]:
    feasible = [
        item
        for item in evaluations
        if item["metrics"]["false_accept_rate"] <= target_far
    ]
    if feasible:
        return min(
            feasible,
            key=lambda item: (
                item["metrics"]["false_reject_rate"],
                item["metrics"]["false_accept_rate"],
                -item["metrics"]["accuracy"],
            ),
        )

    return min(
        evaluations,
        key=lambda item: (
            item["metrics"]["false_accept_rate"],
            item["metrics"]["false_reject_rate"],
            -item["metrics"]["accuracy"],
        ),
    )


def tune_verification(
    samples: list[VerificationSample],
    target_far: float,
    allow_weaker_thresholds: bool,
) -> dict[str, Any]:
    threshold_min = 0.0 if allow_weaker_thresholds else DEFAULTS["MODEL_VERIFY_COSINE_THRESHOLD"]
    margin_min = 0.0 if allow_weaker_thresholds else DEFAULTS["MODEL_VERIFY_COSINE_MARGIN"]
    thresholds = candidate_values(
        [sample.fused_score for sample in samples],
        DEFAULTS["MODEL_VERIFY_COSINE_THRESHOLD"],
        min_value=threshold_min,
    )
    margins = candidate_values(
        [sample.margin_to_impostor for sample in samples],
        DEFAULTS["MODEL_VERIFY_COSINE_MARGIN"],
        padding=0.005,
        min_value=margin_min,
    )

    evaluations = []
    for threshold in thresholds:
        for margin in margins:
            metrics = evaluate_verification(samples, threshold, margin)
            evaluations.append(
                {
                    "params": {
                        "MODEL_VERIFY_COSINE_THRESHOLD": threshold,
                        "MODEL_VERIFY_COSINE_MARGIN": margin,
                    },
                    "metrics": asdict(metrics),
                }
            )

    best = choose_best(evaluations, target_far)
    best["evaluated_candidates"] = len(evaluations)
    return best


def tune_prediction(
    samples: list[PredictionSample],
    target_far: float,
    allow_weaker_thresholds: bool,
) -> dict[str, Any] | None:
    if not any(not sample.is_known for sample in samples):
        return None

    tau_abs_min = 0.0 if allow_weaker_thresholds else DEFAULTS["MODEL_OPENSET_TAU_ABS"]
    tau_margin_min = 0.0 if allow_weaker_thresholds else DEFAULTS["MODEL_OPENSET_TAU_MARGIN"]
    tau_abs_values = candidate_values(
        [sample.best_score for sample in samples],
        DEFAULTS["MODEL_OPENSET_TAU_ABS"],
        min_value=tau_abs_min,
    )
    tau_margin_values = candidate_values(
        [sample.margin for sample in samples],
        DEFAULTS["MODEL_OPENSET_TAU_MARGIN"],
        padding=0.005,
        min_value=tau_margin_min,
    )

    evaluations = []
    for tau_abs in tau_abs_values:
        for tau_margin in tau_margin_values:
            metrics = evaluate_prediction(samples, tau_abs, tau_margin)
            evaluations.append(
                {
                    "params": {
                        "MODEL_OPENSET_TAU_ABS": tau_abs,
                        "MODEL_OPENSET_TAU_MARGIN": tau_margin,
                    },
                    "metrics": asdict(metrics),
                }
            )

    best = choose_best(evaluations, target_far)
    best["evaluated_candidates"] = len(evaluations)
    best["diagnostics"] = prediction_diagnostics(
        samples,
        best["params"]["MODEL_OPENSET_TAU_ABS"],
        best["params"]["MODEL_OPENSET_TAU_MARGIN"],
    )
    return best


def format_env(params: dict[str, float]) -> list[str]:
    return [f"{key}={value:.4f}" for key, value in sorted(params.items())]


def evaluate_prediction_defaults(samples: list[PredictionSample]) -> dict[str, Any]:
    tau_abs = DEFAULTS["MODEL_OPENSET_TAU_ABS"]
    tau_margin = DEFAULTS["MODEL_OPENSET_TAU_MARGIN"]
    return {
        "params": {
            "MODEL_OPENSET_TAU_ABS": tau_abs,
            "MODEL_OPENSET_TAU_MARGIN": tau_margin,
        },
        "metrics": asdict(evaluate_prediction(samples, tau_abs, tau_margin)),
        "diagnostics": prediction_diagnostics(samples, tau_abs, tau_margin),
    }


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    rng = random.Random(args.seed)
    db_path = Path(args.db_path).resolve()
    grouped = load_embeddings(db_path)
    enrollment, probes, unknown = split_subjects(
        grouped=grouped,
        probe_ratio=args.probe_ratio,
        unknown_subject_ratio=args.unknown_subject_ratio,
        rng=rng,
    )
    centroids = build_centroids(enrollment)

    verification_samples = collect_verification_samples(
        enrollment=enrollment,
        probes=probes,
        centroids=centroids,
        top_m=args.top_m,
        max_impostor_pairs=args.max_impostor_pairs,
        rng=rng,
    )
    holdout_prediction_samples = collect_prediction_samples(
        enrollment=enrollment,
        probes=probes,
        unknown=unknown,
        centroids=centroids,
        top_m=args.top_m,
    )

    verification = tune_verification(
        verification_samples,
        args.target_far,
        args.allow_weaker_thresholds,
    )
    prediction = None
    if args.prediction_mode in {"holdout", "both"}:
        prediction = tune_prediction(
            holdout_prediction_samples,
            args.target_far,
            args.allow_weaker_thresholds,
        )

    prediction_replay = None
    replay_samples: list[PredictionSample] = []
    if args.prediction_mode in {"replay", "both"}:
        replay_enrollment = all_subject_vectors(grouped)
        replay_centroids = build_centroids(replay_enrollment)
        replay_samples = collect_prediction_samples(
            enrollment=replay_enrollment,
            probes=replay_enrollment,
            unknown={},
            centroids=replay_centroids,
            top_m=args.top_m,
        )
        prediction_replay = evaluate_prediction_defaults(replay_samples)

    recommendations: dict[str, float] = dict(verification["params"])
    if prediction:
        recommendations.update(prediction["params"])

    return {
        "mode": "offline_recommendation_only",
        "db_path": str(db_path),
        "target_false_accept_rate": args.target_far,
        "seed": args.seed,
        "top_m": args.top_m,
        "allow_weaker_thresholds": bool(args.allow_weaker_thresholds),
        "prediction_mode": args.prediction_mode,
        "data": {
            "subjects_total": len(grouped),
            "subjects_enrolled": len(enrollment),
            "subjects_held_out_as_unknown": len(unknown),
            "enrollment_vectors": int(sum(len(vectors) for vectors in enrollment.values())),
            "known_probe_vectors": int(sum(len(vectors) for vectors in probes.values())),
            "unknown_probe_vectors": int(sum(len(vectors) for vectors in unknown.values())),
            "verification_samples": len(verification_samples),
            "prediction_holdout_samples": len(holdout_prediction_samples),
            "prediction_replay_samples": len(replay_samples),
        },
        "recommendations": recommendations,
        "verification": verification,
        "prediction": prediction,
        "prediction_replay": prediction_replay,
        "notes": [
            "This script does not modify app code, database rows, model artifacts, or environment files.",
            "Holdout prediction calibrates unknown rejection and is stricter than shop/demo replay.",
            "Replay prediction can look much better because it scores stored embeddings against stored templates.",
            "Apply recommendations manually as environment variables only after checking held-out metrics.",
            "For biometric auth, prefer lower false accepts even if false rejects increase.",
        ],
    }


def print_summary(report: dict[str, Any]) -> None:
    print("Offline biometric threshold recommendation")
    print("=" * 45)
    print(f"Database: {report['db_path']}")
    print(f"Target FAR: {report['target_false_accept_rate']}")
    print(f"Prediction mode: {report['prediction_mode']}")
    print(f"Subjects enrolled: {report['data']['subjects_enrolled']}")
    print(f"Subjects held out as unknown: {report['data']['subjects_held_out_as_unknown']}")
    print()

    print("Recommended env values:")
    for line in format_env(report["recommendations"]):
        print(f"  {line}")
    print()

    verification = report["verification"]
    verify_metrics = verification["metrics"]
    print("Verification metrics:")
    print(f"  FAR: {verify_metrics['false_accept_rate']:.4f}")
    print(f"  FRR: {verify_metrics['false_reject_rate']:.4f}")
    print(f"  Accuracy: {verify_metrics['accuracy']:.4f}")
    print(f"  Candidates evaluated: {verification['evaluated_candidates']}")
    print()

    prediction = report["prediction"]
    if prediction:
        predict_metrics = prediction["metrics"]
        predict_diagnostics = prediction["diagnostics"]
        print("Prediction holdout metrics:")
        print(f"  Unknown false accept rate: {predict_metrics['false_accept_rate']:.4f}")
        print(f"  Known false reject/error rate: {predict_metrics['false_reject_rate']:.4f}")
        print(
            "  Known top-1 accuracy before thresholds: "
            f"{predict_diagnostics['known_top1_accuracy_before_threshold']:.4f}"
        )
        print(
            "  Known rejected by abs/margin: "
            f"{predict_diagnostics['known_rejected_by_abs']}/"
            f"{predict_diagnostics['known_rejected_by_margin']}"
        )
        print(f"  Accuracy: {predict_metrics['accuracy']:.4f}")
        print(f"  Candidates evaluated: {prediction['evaluated_candidates']}")
    else:
        print("Prediction holdout metrics: skipped.")
    print()

    prediction_replay = report.get("prediction_replay")
    if prediction_replay:
        replay_metrics = prediction_replay["metrics"]
        replay_diagnostics = prediction_replay["diagnostics"]
        print("Prediction replay metrics:")
        print(f"  Known false reject/error rate: {replay_metrics['false_reject_rate']:.4f}")
        print(
            "  Known top-1 accuracy before thresholds: "
            f"{replay_diagnostics['known_top1_accuracy_before_threshold']:.4f}"
        )
        print(
            "  Known rejected by abs/margin: "
            f"{replay_diagnostics['known_rejected_by_abs']}/"
            f"{replay_diagnostics['known_rejected_by_margin']}"
        )
        print(f"  Accuracy: {replay_metrics['accuracy']:.4f}")
    print()

    print("Nothing was applied automatically. Use these as env vars only after review.")


def main() -> int:
    args = parse_args()
    if not 0.0 <= args.target_far <= 1.0:
        raise ValueError("--target-far must be between 0 and 1")
    if not 0.0 < args.probe_ratio < 1.0:
        raise ValueError("--probe-ratio must be between 0 and 1")
    if not 0.0 <= args.unknown_subject_ratio < 1.0:
        raise ValueError("--unknown-subject-ratio must be between 0 and 1")
    if args.max_impostor_pairs < 0:
        raise ValueError("--max-impostor-pairs must be non-negative")
    if args.top_m <= 0:
        raise ValueError("--top-m must be positive")

    report = build_report(args)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_summary(report)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1)
