# ArcFace to ANN Migration Guide

## Purpose

This document explains the migration from KNN-based prediction to ANN retrieval plus rerank, including:

- the theory behind the approach,
- what changed in training and runtime,
- why accuracy can regress after migration,
- what was fixed in this codebase,
- and how to tune/operate the system safely.

## Executive Summary

The model uses ArcFace-like training for discriminative embeddings, but runtime identity is now solved as nearest-neighbor retrieval in embedding space:

1. Retrieve candidates quickly with ANN (FAISS IVF, inner product on normalized vectors).
2. Rerank with exact cosine.
3. Aggregate scores at label level (not single template only).
4. Apply open-set acceptance policy (`unknown` rejection).
5. For verification, combine claimed-user signals with impostor margin checks.

This replaces the previous KNN classifier path.

## Why Move from KNN to ANN + Rerank

KNN classification can work on small datasets, but retrieval-style serving is more scalable and easier to reason about for biometric systems:

- **Scalability**: ANN supports larger template sets without O(N) full search latency.
- **Separation of concerns**: retrieval stage for recall, rerank stage for precision.
- **Open-set behavior**: thresholding on similarity/margins is explicit.
- **Debuggability**: top-k candidates and scores are visible.

## Core Theory

### 1) Embedding Geometry

All embeddings are L2-normalized. For normalized vectors:

- cosine similarity and inner product are equivalent,
- higher score means closer identity,
- score range is typically near `[-1, 1]` (but practical ranges are narrower).

### 2) ANN Retrieval + Exact Rerank

ANN retrieves likely neighbors quickly but can miss exact top candidates. Rerank with exact dot-product/cosine on retrieved candidates restores precision.

### 3) Open-Set Recognition

Identification is open-set: "none of the known users" must map to `unknown`.
Typical policy:

- accept only if best score passes absolute threshold,
- and best-vs-second margin is high enough.

### 4) Why Single-Template NN Can Fail

In biometric data, one user's templates may be noisy/outlier-heavy. A single nearest template can be misleading.

Mitigation:

- aggregate multiple templates per label (`top-m mean`),
- add per-label centroid similarity,
- compare against impostor scores.

This is now implemented.

## Migration Changes in This Repository

### A) Artifact Format and Runtime

Runtime now relies on:

- `{model_name}_rp_templates.joblib`
- `{model_name}_flatip.faiss` (FAISS IVF index when available)
- `{model_name}_label_encoder.joblib`

### B) Retrieval Index Build

`train_retrieval_index()` now:

- saves normalized template vectors + labels,
- builds FAISS IVF-Flat index when FAISS is present,
- stores index with backup-safe writes.

If FAISS is unavailable, runtime still works with exact NumPy search.

### C) Candidate Search Fixes

Important correctness fixes:

- ANN path now overfetches candidates before rerank (improves recall).
- Non-FAISS fallback no longer truncates too early; exact mode can score all templates to avoid dropping true identities.

### D) Label-Level Scoring for Identification

`identify_image()` no longer trusts only a single nearest template.
It builds label-level scores using:

- best template score,
- top-m mean template score per label,
- centroid score per label,
- weighted fusion for final ranking.

### E) Verification Logic Improvements

`verify_claimed_identity()` now computes:

- best claimed template score,
- claimed top-m mean,
- claimed centroid score,
- fused claimed confidence,
- impostor best score (template and centroid views),
- claimed-vs-impostor margin.

Decision now has explicit reasons:

- `accepted`
- `accepted_high_confidence_bypass`
- `rejected_below_threshold`
- `rejected_low_margin`

### F) API Debug Signals

`/verify` includes diagnostics to support fast root-cause analysis:

- `verify_margin`
- `verify_margin_threshold`
- `verify_decision`
- `verify_impostor_best_score`
- `verify_impostor_best_centroid_score`

### G) Predict vs Verify Policy Split

Prediction and verification now use separate frame-consistency knobs.
This prevents strict verification policy from over-penalizing 1:N identification.

## Why Accuracy Dropped During Migration (Observed Failure Modes)

The following issues were identified and fixed during migration hardening:

1. **ANN index not truly used** in some flows (templates saved, weak/no index path).
2. **Small-dataset IVF misconfiguration** (`nlist` too large for template count).
3. **Candidate truncation** in exact fallback path.
4. **Single-template dominance** causing unstable class assignment.
5. **Verification margin gate** rejecting cases where threshold passed but impostor score was higher.
6. **Predict/verify threshold coupling** making prediction too strict.

## FAISS IVF Sizing Guidance

If you see warnings like:

`clustering X points to Y centroids: please provide at least ... training points`

it means `nlist` is too high for your dataset size.

Practical guidance for this project size:

- with ~100-300 templates, start with `nlist=8` or `16`,
- set `nprobe` to a meaningful fraction of `nlist` (e.g. 4 for 8, 8 for 16),
- retrain index after changing these values.

## Environment Variables

### Retrieval and Open-Set

- `MODEL_OPENSET_TAU_ABS` (default `0.58`)
- `MODEL_OPENSET_TAU_MARGIN` (default `0.02`)
- `MODEL_RETRIEVAL_TOP_K` (default `80`)
- `MODEL_RETRIEVAL_NPROBE` (default `8`)
- `MODEL_RETRIEVAL_IVF_NLIST` (default `64`, lower for small datasets)
- `MODEL_RETRIEVAL_ANN_OVERFETCH_FACTOR` (default `8`)
- `MODEL_IDENTIFY_LABEL_TOP_M` (default `3`)

### Verification (model-level)

- `MODEL_VERIFY_COSINE_THRESHOLD` (default `0.52`)
- `MODEL_VERIFY_COSINE_MARGIN` (default `0.015`)
- `MODEL_VERIFY_MARGIN_BYPASS_DELTA` (default `0.03`)
- `MODEL_VERIFY_TOP_M` (default `3`)

### API Frame Voting (predict path)

- `MODEL_PREDICT_CONFIDENCE_THRESHOLD` (default `0.50`)
- `MODEL_PREDICT_MIN_ACCEPTED_FRAMES` (default `1`)
- `MODEL_PREDICT_MIN_ACCEPTED_RATIO` (default `0.34`)
- `MODEL_PREDICT_STRONG_CONFIDENCE_THRESHOLD` (default `0.75`)
- `MODEL_PREDICT_ALLOW_SINGLE_GOOD_FRAME` (default `true`)

### API Frame Voting (verify path)

- `MODEL_VERIFY_CONFIDENCE_THRESHOLD` (default `0.60`)
- `MODEL_VERIFY_MIN_ACCEPTED_FRAMES` (default `2`)
- `MODEL_VERIFY_MIN_ACCEPTED_RATIO` (default `0.5`)
- `MODEL_VERIFY_STRONG_CONFIDENCE_THRESHOLD` (default `0.9`)
- `MODEL_VERIFY_ALLOW_SINGLE_GOOD_FRAME` (default `true`)

## Operational Runbook

After changing retrieval or scoring code:

1. Restart model API.
2. Trigger retraining (`/initial_training`) to rebuild artifacts.
3. Validate both `/predict` and `/verify`.
4. Inspect debug fields for rejected verifications.
5. Tune thresholds only after checking impostor-vs-claimed score distributions.

## Troubleshooting Checklist

If verification fails with high confidence:

- Check `verify_decision`.
- If `rejected_low_margin`, inspect impostor scores and centroid impostor score.
- If impostor consistently wins, suspect data overlap/noise and re-enroll templates.
- If IVF warning appears, reduce `MODEL_RETRIEVAL_IVF_NLIST`.

If prediction returns too many `unknown`:

- lower `MODEL_OPENSET_TAU_ABS` slightly,
- reduce `MODEL_OPENSET_TAU_MARGIN`,
- ensure ANN overfetch and rerank are active.

## File Map

```text
model/mok/pipeline/ml_controller.py
  - index training
  - retrieval search + rerank
  - label/centroid aggregation
  - verification and margin policy

model/mok/api/server.py
  - /predict and /verify endpoints
  - frame-level aggregation
  - debug response fields
```

---
