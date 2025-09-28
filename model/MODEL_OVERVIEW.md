## Face Recognition Model — Repository Overview / Map

This document gives a concise map of the model codebase, the training/inference flow, configuration knobs, and where artifacts are saved.

### Top-level layout (model/)

- `README.md`: High-level project description and setup.
- `requirements.txt`: Python dependencies.
- `src/`: Application and ML code (detailed below).
- `data/`: Datasets and generated assets (DB, logs, trained models when using the controller flow).
- `documentation/`: Papers and docs.
- `tests/`: Notebooks and unit tests.
- `venv/`: Local virtual environment (if created in-place).

### `src/` layout

- `app.py`: Flask app entry for the legacy UI.
- `config.py`: Central configuration for training/inference (paths, image size, splits, model options).
- `controller/`
  - `ml_controller.py`: V2 modular training/inference API (prepare → create_model → train → predict). Saves artifacts under `data/ml_models/` by default.
  - `database_controller.py`: Reads images from SQLite DB (`data/gui_database.db`).
- `face_recognition/`
  - `ml_models.py`: Model builders
    - `build_simple_cnn(...)`: Small CNN for grayscale or RGB inputs.
    - `build_transfer_model(...)`: Transfer learning with backbones (`MobileNetV2`, `ResNet50`, `EfficientNetB0`).
  - `train.py`: End-to-end training script driven by `src/config.py`.
  - `predict.py`: CLI-style single image prediction script (loads saved model + label encoder).
- `modules/`
  - `data_loader.py`: Load images (flat directory), label encode subjects, and split datasets (stratified or fixed-per-subject).
  - `image_preprocessing.py`: Utilities to normalize/flatten/resize images.
  - `anony_process_pipeline.py`, `eigenface.py`, `k_same_pixel.py`, etc.: Anonymization and utility pipelines used upstream of training.
- `templates/`, `static/`: Legacy web UI assets.

### Artifacts and logs

There are two saving conventions depending on the entry point you use:

- Via `src/face_recognition/train.py` (V1 script): artifacts under `models/` (see `MODEL_SAVE_DIR`, `LOG_DIR` in `src/config.py`).
- Via `src/controller/ml_controller.py` (V2 controller): artifacts under `data/ml_models/` (`trained/`, `logs/`).

Saved files include:

- Trained model: `<MODEL_NAME>.h5`
- Label encoder: `<MODEL_NAME>_label_encoder.joblib`
- Training curves: `<MODEL_NAME>_training_curves.pdf`
- CSV training log: `<MODEL_NAME>_training_log.csv`

### Data expectations

- Flat directory of anonymized images specified by `ANONY_IMAGES_PATH`.
- File name pattern expected by `data_loader.load_anonymized_images_flat(...)`:
  - `reconstructed_<subject_id>_<num>.png` (subject ID is used as the label).
- Alternatively, images can be loaded from SQLite via `MLController.get_data_from_db(...)`.

### Training pipeline (what happens)

1. Load config from `src/config.py` (paths, image size, architecture, splits, hyperparameters).
2. Load images and labels:
   - From disk: `modules/data_loader.load_anonymized_images_flat(...)`.
   - Or from DB: `controller/ml_controller.get_data_from_db(...)`.
3. Preprocess images to `(H, W, C)` and normalize to `[0, 1]`.
4. Encode subject IDs with `LabelEncoder` (saved for inference).
5. Split into train/val/test using:
   - `split_data_stratified(...)` (balanced splits), or
   - `split_data_fixed_per_subject(...)` (exact N per class for training).
6. Build model from `face_recognition/ml_models.py`:
   - `simple_cnn` or `transfer_<Backbone>` (optionally freeze base).
7. Compile with Adam, `sparse_categorical_crossentropy`, `accuracy`.
8. Train with callbacks: `ModelCheckpoint`, optional `EarlyStopping`, TensorBoard, CSV logger.
9. Save best model + label encoder; export training curves and logs.

### Inference pipeline

1. Load `<MODEL_NAME>.h5` and `<MODEL_NAME>_label_encoder.joblib`.
2. Preprocess input image to the configured `(H, W, C)` and scale to `[0, 1]`.
3. Run `model.predict(...)` → softmax probabilities.
4. Take `argmax` class index → map back to subject ID using the label encoder; report confidence.

### Configuration knobs (`src/config.py`)

- Paths and names:
  - `ANONY_IMAGES_PATH`, `MODEL_SAVE_DIR`, `LOG_DIR`, `MODEL_NAME`.
- Image and preprocessing:
  - `IMG_WIDTH`, `IMG_HEIGHT`, `COLOR_MODE` (`'grayscale'` or `'rgb'`), `CHANNELS`.
- Splits:
  - `SPLIT_STRATEGY` (`'stratified'` or `'fixed_per_subject'`), `TEST_SPLIT_RATIO`, `VALIDATION_SPLIT_RATIO`, `N_TRAIN_PER_SUBJECT`, `RANDOM_STATE`.
- Model:
  - `MODEL_ARCHITECTURE` (`'simple_cnn'`, `'transfer_MobileNetV2'`, `'transfer_ResNet50'`, ...), `TRANSFER_BASE_MODEL_NAME`, `TRANSFER_FREEZE_BASE`.
- Training hyperparameters:
  - `EPOCHS`, `BATCH_SIZE`, `LEARNING_RATE`, `EARLY_STOPPING_PATIENCE`.

### Entry points

- Train (V1 script):
  - `python -m src.face_recognition.train`
- Predict (CLI):
  - `python -m src.face_recognition.predict <path_to_image>`
- Programmatic (V2 controller):
  - Use `MLController` in `src/controller/ml_controller.py`:
    - `prepare_data()` → `create_model()` → `train_model()` → `predict_image(...)`.

### Models at a glance

- `simple_cnn`:
  - Two Conv blocks (32/64 filters) with BatchNorm + Dropout → Flatten → Dense(128) + Dropout → Softmax.
- `transfer_<Backbone>`:
  - `tf.keras.applications` backbone without top → GlobalAveragePooling → Dense(128) + Dropout → Softmax. Backbones include `MobileNetV2`, `ResNet50`, `EfficientNetB0`.
  - Note: most transfer backbones expect RGB (`CHANNELS=3`).

### Useful files to open

- `src/face_recognition/ml_models.py`: model builders.
- `src/face_recognition/train.py`: end-to-end training.
- `src/face_recognition/predict.py`: inference CLI.
- `src/modules/data_loader.py`: loading/splitting utilities.
- `src/controller/ml_controller.py`: modular training API and reporting.
