# ArcFace Implementation Guide

## Overview

ArcFace (Additive Angular Margin Face Recognition) has been integrated into the facial recognition model to improve accuracy and discrimination between different subjects. This document describes the changes made, the benefits, and how to use the new system.

## What is ArcFace?

ArcFace adds an **angular margin** to the loss function during training, which forces the model to learn embeddings that are more discriminative and better separated in feature space. This results in:

- **Better accuracy**: More discriminative embeddings lead to better recognition
- **Improved robustness**: The model generalizes better to unseen variations
- **Clearer decision boundaries**: Classes are farther apart in embedding space

## Changes Made

### 1. New Custom Layers (`mok/models/ml_models.py`)

#### `ArcFace` Layer

- Implements the ArcFace margin mechanism
- Takes two inputs: `[embeddings, labels]`
- During **training** (`training=True`): Applies angular margin to make embeddings more discriminative
- During **inference** (`training=False`): Returns plain cosine similarity (no margin)
- Configurable parameters:
  - `margin`: Angular margin in radians (default: 0.25)
  - `scale`: Scale factor for logits (default: 64.0)

#### `L2Normalize` Layer

- Replaces Lambda layers for proper serialization
- Normalizes embeddings to unit length before ArcFace computation
- Ensures embeddings are on a hypersphere

#### `ZeroLabelsLayer` Layer

- Replaces Lambda layers for proper serialization
- Generates zero labels for inference mode (when labels aren't available)

### 2. New Model Architecture (`mok/models/ml_models.py`)

#### `build_arcface_cnn()` Function

Returns a **tuple of two models**:

```python
training_model, inference_model = build_arcface_cnn(
    input_shape=(100, 100, 1),
    num_classes=16,
    embedding_dim=128,
    margin=0.25,
    scale=64.0
)
```

**Training Model** (`{model_name}.h5`):

- Inputs: `[image, label]` (2 inputs)
- Used during `model.fit()` with training data
- Applies ArcFace margin during loss computation
- Output shape: (batch_size, num_classes)

**Inference Model** (`{model_name}_inference.h5`):

- Input: `image` only (1 input)
- Used for prediction on new images
- No margin applied
- Shares weights with training model
- Output shape: (batch_size, num_classes)

### 3. Training Pipeline Updates (`mok/pipeline/ml_controller.py`)

#### Model Creation

- ArcFace is the only supported architecture
- ArcFace parameters configurable via `create_model()`:
  - `arc_embedding_dim`: Size of feature embedding (default: 128)
  - `arc_margin`: Angular margin (default: 0.35)
  - `arc_scale`: Scale factor (default: 30.0)

#### Training Data Format

- Training inputs: `[X_train, y_train]` (image + labels)
- Validation inputs: `[val_x, val_y]` (image + labels)
- Labels are automatically passed to ArcFace during training

#### Model Saving

- After training completes, both models are saved:
  - Training model: `{model_name}.h5`
  - Inference model: `{model_name}_inference.h5`

#### Evaluation

- Uses inference model for validation accuracy
- Evaluation inputs: `X_test` only (no labels needed)

### 4. Prediction Pipeline (`mok/pipeline/ml_controller.py`)

#### Auto-Detection

The `predict_image()` function now:

1. Checks if inference model exists (`{model_name}_inference.h5`)
2. If yes → uses inference model (1 input: image only)
3. If no → checks if training model requires 2 inputs
4. If yes → passes dummy zero labels for inference
5. If no → uses standard single-input model

#### Custom Objects Support

Model loading now includes custom layers:

```python
custom_objects = {
    "ArcFace": ArcFace,
    "L2Normalize": L2Normalize,
    "ZeroLabelsLayer": ZeroLabelsLayer
}
```

#### Safe Mode

Models are loaded with `safe_mode=False` to allow deserialization of custom layers.

## How to Use

### Option 1: Train New ArcFace Model

```python
from mok.pipeline.ml_controller import MLController

controller = MLController()

results = controller.train_model(
    # ... other training parameters ...
    arc_embedding_dim=128,
    arc_margin=0.35,
    arc_scale=30.0,
    learning_rate=0.002,  # Recommended for ArcFace
    epochs=50,
    batch_size=32,
)
```

### Option 2: Predict with ArcFace Model

```python
from PIL import Image
import numpy as np
from mok.pipeline.ml_controller import MLController

controller = MLController()

# Load and predict (automatic detection of model type)
image = Image.open("path/to/image.png")
image_np = np.array(image.convert("RGB"))

predicted_label, confidence = controller.predict_image(image_np)
print(f"Predicted: {predicted_label} (confidence: {confidence:.4f})")
```

### Option 3: Using predict.py Script

```bash
# Predict on anonymized training dataset and personal images
python mok/pipeline/predict.py --method dp_svd

# Custom parameters
python mok/pipeline/predict.py \
    --method peep \
    --my-face-dir datasets/my_face \
    --my-face-subject-id 16 \
    --my-face-margin 0.35
```

## Training vs Inference Models

### Why Two Models?

**During Training**:

- Need labels to compute ArcFace margin
- Model input: `[image, label]`
- Margin: applied to pull same-class embeddings together and push different-class apart

**During Inference**:

- No labels available for new images
- Model input: `image` only
- Margin: NOT applied (just use cosine similarity)

### Model Relationship

```
Shared Base Network:
  image → CNN layers → embedding (128-dim) → L2 normalization

Training Path:
  [embedding, label] → ArcFace(with margin) → logits → softmax

Inference Path:
  [embedding, zero_labels] → ArcFace(no margin) → logits → softmax
  OR
  [embedding] → inference model → logits → softmax
```

## Configuration Parameters

### ArcFace Hyperparameters

#### `arc_margin` (default: 0.35)

- **Range**: 0.0 to π (typically 0.1 to 0.5)
- **Effect**:
  - **Larger margin** (0.5+): More aggressive separation, may cause training difficulty
  - **Smaller margin** (0.1-0.25): Easier training, less aggressive
  - **Recommended**: Start with 0.25-0.35

#### `arc_scale` (default: 30.0)

- **Range**: 1.0 to 100+
- **Effect**:
  - Scales the logits before softmax
  - Larger scale = sharper decision boundaries
  - **Recommended**: 30-64

#### `arc_embedding_dim` (default: 128)

- Dimension of the feature embedding vector
- Larger = more expressive, but slower
- **Recommended**: 128-256

### Training Parameters

When using ArcFace, adjust:

```python
learning_rate=0.002  # Slightly higher than standard (0.001)
arc_margin=0.25      # Start conservative
arc_scale=30.0       # Medium scale
epochs=50            # May need more epochs
batch_size=32        # Standard batch size
```

## File Structure

```
mok/
├── models/
│   └── ml_models.py          # ArcFace layers and model builder
└── pipeline/
    ├── ml_controller.py      # Training and prediction pipeline
    └── predict.py            # Prediction script

data/ml_models/trained/
├── {model_name}.h5                      # Training model
├── {model_name}_inference.h5            # Inference model
├── {model_name}_label_encoder.joblib    # Label encoder
└── {model_name}_training_curves.pdf     # Training curves
```

## Example Workflow

### 1. Prepare Data

```python
from mok.pipeline.ml_controller import MLController

controller = MLController()
# Data preparation happens automatically
```

### 2. Train with ArcFace

```python
results = controller.train_model(
    num_subjects=16,
    arc_margin=0.25,
    learning_rate=0.002,
    epochs=50,
    show_logs=True
)
```

### 3. Validate on Training Dataset

```python
python mok/pipeline/predict.py --method dp_svd
```

### 4. Test on Personal Images

```python
# Predicts personal images and generates validation plots
# See: data/results/validation_results_*.png
```

## Summary of Changes

| Component       | Change                     | Benefit                     |
| --------------- | -------------------------- | --------------------------- |
| Loss Function   | Added ArcFace margin       | Better discrimination       |
| Model Structure | Dual model (train + infer) | Proper training & inference |
| Custom Layers   | Replaced Lambdas           | Better serialization        |
| Prediction      | Auto-detection             | Backward compatible         |
| Configuration   | New ArcFace parameters     | Fine-grained control        |

---

**Last Updated**: 2026-02-07  
**Status**: Production Ready
