# ArcFace + ANN Implementation

## Purpose

This document describes how this system performs face recognition using:

- ArcFace-style metric learning to train discriminative embeddings
- ANN (Approximate Nearest Neighbor) retrieval for fast candidate search
- exact cosine reranking and label-level aggregation for final decisions

It explains how the pipeline works during:

1. training
2. verification (1:1, claimed identity)
3. prediction/identification (1:N, unknown user possible)

## Architecture Overview

The pipeline is split into two layers:

- **Embedding model (ArcFace-style):** maps face images to normalized vectors.
- **Retrieval + decision layer (ANN + rerank):** compares vectors against enrolled templates.

At runtime, identity is not produced by a softmax classifier. Instead, identity is inferred by nearest-neighbor retrieval in embedding space.

## ArcFace Fundamentals

ArcFace optimizes embeddings so that:

- same identity vectors are close
- different identity vectors are far apart

### Normalized embedding space

For each sample, the embedding `x` is L2-normalized (`||x||=1`).
Classifier weights are also normalized. Similarity then becomes angular/cosine.

### Additive angular margin

ArcFace modifies the target logit by adding an angular margin `m`:

- target class logit uses `cos(theta_y + m)`
- non-target class logits use `cos(theta_j)`

This creates stronger class separation and more stable verification margins than plain softmax embeddings.

### Why this matters for ANN

Because embeddings are normalized:

- cosine similarity and inner product are equivalent
- ANN index can use inner-product search for fast candidate retrieval
- exact rerank can use cosine over the candidate set without changing ranking semantics

## ANN Retrieval Fundamentals

The system stores enrolled face templates and searches them with ANN:

1. Retrieve top candidate templates quickly (approximate).
2. Rerank candidates with exact cosine (precise).
3. Aggregate template scores into label-level confidence.
4. Apply open-set policy (`unknown`) or claimed-identity policy (verify).

ANN is used for speed. Exact rerank and label aggregation are used for correctness.

## Training Pipeline (Step-by-Step)

Training produces both model parameters and retrieval artifacts.

### 1) Data preparation

- detect and crop face
- standardize size/alignment
- apply preprocessing/augmentation
- assign identity labels

### 2) ArcFace embedding training

- forward pass through backbone to embedding vector
- L2-normalize embedding
- compute ArcFace margin logits
- optimize with cross-entropy on identity labels
- validate and checkpoint best model

### 3) Template extraction

After training, run enrollment images through the embedding model:

- generate one or more embeddings per identity
- L2-normalize all embeddings
- persist `templates` and aligned `labels`

### 4) Build retrieval artifacts

- build FAISS IVF-Flat (or equivalent ANN index) over normalized templates
- save index and metadata
- save label encoder / id mapping
- optionally compute per-label centroid embeddings

### 5) Runtime-ready outputs

Typical outputs are:

- trained embedding model weights
- template matrix + labels
- ANN index file
- label encoder and optional centroids

## Verification Flow (1:1, Claimed Identity)

Verification answers: "Does this probe face belong to claimed user X?"

### Input

- probe face image (or video frame set)
- claimed identity id/label

### Steps

1. **Preprocess probe:** detect/crop/align face.
2. **Embed probe:** run ArcFace model and L2-normalize vector.
3. **Retrieve candidates:** ANN search returns top-k nearest templates.
4. **Exact rerank:** recompute cosine against candidate vectors.
5. **Filter claimed identity:** keep scores belonging to claimed label.
6. **Compute claimed confidence:** combine signals such as:
   - best claimed template score
   - claimed top-m mean score
   - claimed centroid similarity (if enabled)
7. **Compute impostor risk:** best non-claimed score / centroid score.
8. **Margin test:** evaluate claimed score minus best impostor score.
9. **Decision policy:**
   - accept if claimed score >= threshold and margin >= margin threshold
   - otherwise reject
10. **Return diagnostics:** score, margin, reason code, and optional debug fields.

### Output

- `accepted` / `rejected`
- confidence and margin metrics
- optional decision reason (below threshold, low margin, etc.)

## Prediction / Identification Flow (1:N, Open Set)

Prediction answers: "Who is this person?" where unknown users must be rejected.

### Input

- probe face image (or frame sequence)

### Steps

1. **Preprocess probe** and generate normalized embedding.
2. **ANN retrieval:** fetch top-k candidate templates.
3. **Exact rerank:** cosine score each candidate exactly.
4. **Label aggregation:** convert template-level scores to identity-level scores:
   - best template score per label
   - top-m mean per label
   - centroid similarity per label (optional)
   - weighted fusion into final label confidence
5. **Rank labels** by fused confidence.
6. **Open-set gate:** apply:
   - absolute threshold (best score must be high enough)
   - margin threshold (best minus second-best sufficiently large)
7. **Return result:**
   - top identity if accepted
   - `unknown` if open-set gate fails

### Output

- predicted label or `unknown`
- confidence, top candidates, and optional debug info

## Multi-Frame Handling (When Video Is Used)

For both prediction and verification, frame-level decisions can be aggregated:

- run embedding + decision per frame
- count accepted frames and confidence distribution
- apply min-frames / min-ratio / strong-single-frame rules
- produce one final response for the full capture window

This reduces instability from blur, pose, and transient occlusions.

## Why ArcFace + ANN Works Well

- ArcFace provides highly separable identity embeddings.
- ANN scales nearest-neighbor search to larger template sets.
- Exact rerank recovers precision lost in approximate retrieval.
- Label-level fusion is more robust than single-template winner-take-all.
- Open-set and margin policies make acceptance behavior explicit and tunable.

## Practical Notes

- Keep embeddings normalized end-to-end.
- Use ANN overfetch + exact rerank to avoid recall loss.
- Size IVF parameters to dataset scale (small sets need small `nlist`).
- Tune thresholds from real score distributions (genuine vs impostor), not guesses.
- Rebuild index after enrollment changes or retrieval hyperparameter changes.

## File Map

```text
model/mok/pipeline/ml_controller.py
  - embedding extraction
  - retrieval index training
  - ANN search + exact rerank
  - identify/verify scoring logic

model/mok/api/server.py
  - /predict and /verify endpoint orchestration
  - frame-level aggregation and response formatting
```
