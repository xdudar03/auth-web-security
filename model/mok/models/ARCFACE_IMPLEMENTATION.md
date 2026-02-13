# ArcFace + KNN Implementation Guide

## Overview

This project uses ArcFace during model training and KNN during runtime prediction.

- ArcFace improves embedding discrimination while training.
- KNN is the online classifier used by `predict_image()`.
- There is no separate inference `.h5` model in the current pipeline.

## Current Architecture

### Training path

1. Build a vector-based ArcFace training model in `mok/models/ml_models.py`.
2. Train with labeled inputs: `[X_train, y_train]`.
3. Evaluate with the same training model interface.
4. Train and save a KNN classifier on embeddings.

### Runtime prediction path

`predict_image()` in `mok/pipeline/ml_controller.py` loads:

- `{model_name}_knn.joblib`
- `{model_name}_label_encoder.joblib`

Then it predicts identity from a single embedding vector using KNN.

## ArcFace Components

### `ArcFace` layer

- Applies angular margin when labels are provided in training.
- Returns scaled cosine logits when labels are absent or `training=False`.

### `L2Normalize` layer

- Normalizes embeddings before ArcFace logits.
- Replaces lambda-style normalization for safer serialization.

## Model Builder

### `build_arcface_vector()`

- Returns one model: the ArcFace training model.
- Input shape: `(input_dim,)` plus label input for ArcFace loss behavior.
- Output shape: `(batch_size, num_classes)`.

## Training Pipeline Notes

In `mok/pipeline/ml_controller.py`:

- `create_model()` builds and compiles only the training model.
- `train_model()` fits, evaluates, saves encoder, and trains KNN.
- Evaluation uses the training model inputs directly.

## Saved Artifacts

After training, expected artifacts are:

- `{model_name}.h5` (training model checkpoint)
- `{model_name}_knn.joblib` (runtime classifier)
- `{model_name}_label_encoder.joblib` (label mapping)
- `{model_name}_training_log.csv` (training log)
- `{model_name}_training_curves.pdf` (optional curves)

## Prediction Contract

`predict_image(vector_array, model_save_dir, model_name)` expects an embedding vector that matches the KNN feature dimension.

Behavior:

- Validates vector length.
- Predicts class with KNN.
- Computes confidence/margin checks.
- Returns `(predicted_label, confidence)` or `("unknown", 0.0)` when rejected.

## File Structure

```text
mok/
├── models/
│   └── ml_models.py          # ArcFace layers and vector model builder
└── pipeline/
    └── ml_controller.py      # Training + KNN prediction pipeline

data/ml_models/trained/
├── {model_name}.h5                      # ArcFace training model checkpoint
├── {model_name}_knn.joblib              # KNN classifier used in runtime
├── {model_name}_label_encoder.joblib    # Label encoder
└── {model_name}_training_curves.pdf     # Training curves (if generated)
```

---

**Last Updated**: 2026-02-13  
**Status**: Production Ready
