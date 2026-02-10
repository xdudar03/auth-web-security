import base64
import os
import io
import time
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt

from tensorflow import float32, convert_to_tensor
from tensorflow.image import resize, rgb_to_grayscale, grayscale_to_rgb, convert_image_dtype
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense, Dropout, Activation
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, TensorBoard, CSVLogger

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report

from mok.preprocessing.utils_image import pillow_image_to_bytes
import mok.data.data_loader as data_loader
import mok.models.ml_models as ml_models
from mok.preprocessing.utils_image import base64_image_to_numpy
from mok.persistence.database_controller import DatabaseController

class MLController:

    # Data source & final model
    X, y, label_encoder = None, None, None
    model = None
    inference_model = None
    duration = 0

    # Paths
    _db_path = os.environ.get("SQLITE_DB_PATH", DatabaseController.DEFAULT_DB_PATH)
    _ml_output = "data/ml_models"
    _model_save_dir = f'{_ml_output}/trained'
    _log_dir = f'{_ml_output}/logs'

    ############# MODEL SETTINGS #############
    #####--- prepare_data_train_model ---#####
    INPUT_SHAPE = (100, 100, 1)
    SPLIT_STRATEGY = 'stratified'
    TEST_SPLIT_RATIO = 0.2
    VALIDATION_SPLIT_RATIO = 0.15
    RANDOM_STATE = 42
    N_TRAIN_PER_SUBJECT = 7
    #####--- create_model ---#####
    MODEL_NAME = 'arcface_yale_anony_v1'
    #####--- train_model ---#####

    # for dp-svd anonymization
    LEARNING_RATE = 0.0005 
    BATCH_SIZE = 16
    EPOCHS = 140

    # ArcFace settings
    ARC_EMBEDDING_DIM = 128
    ARC_MARGIN = 0.35
    ARC_SCALE = 30.0

    EARLY_STOPPING_PATIENCE = 20
    
    ##########################################

    # Data preparation
    num_classes = None
    X_train, y_train, X_test, y_test, X_val, y_val = [None]*6
    validation_data = None
    callbacks, model_filepath, summary_text = [None]*3
    output_train = None

    def __init__(self, db_path=None, ml_output=None, data=None):
        if db_path: self._db_path = db_path
        if ml_output:
            self._ml_output = ml_output
            self._model_save_dir = f"{self._ml_output}/{self._model_save_dir.split('/')[-1]}"
            self._log_dir = f"{self._ml_output}/{self._log_dir.split('/')[-1]}"
        # Get data from database
        if data:
            self.X, self.y, self.label_encoder = data
        else:
            self.X, self.y, self.label_encoder = self.get_data_from_db(self._db_path)

    @classmethod
    def convert_file_storage_to_numpy(cls, file_storage: str):
        image = Image.open(file_storage.stream)
        # TODO : do all the preprocessing & the PEEP processing
        return np.array(image)


    @classmethod
    def get_data_from_db(cls, db_path = None):
        resolved_path = db_path or os.environ.get(
            "SQLITE_DB_PATH",
            DatabaseController.DEFAULT_DB_PATH,
        )
        db = DatabaseController(resolved_path)
        print(f"Getting data from database at {resolved_path}")
        image_dict = {}
        embeddings_result = db.get_embeddings_table()
        print(f"Embeddings rows fetched: {len(embeddings_result)}")
        for user_id, raw_value in embeddings_result:
            print(f"Parsing embeddings for user_id={user_id} (raw_type={type(raw_value).__name__})")
            try:
                decoded = json.loads(raw_value)
            except Exception:
                decoded = raw_value
            images = []
            if isinstance(decoded, list):
                if decoded and all(isinstance(item, (int, float)) for item in decoded):
                    images = [np.array(decoded)]
                elif decoded and all(isinstance(item, (list, tuple)) for item in decoded):
                    if all(all(isinstance(val, (int, float)) for val in item) for item in decoded):
                        images = [np.array(item) for item in decoded]
                    elif all(isinstance(item, str) for item in decoded):
                        images = decoded
                    else:
                        images = [np.array(decoded)]
                elif decoded and all(isinstance(item, str) for item in decoded):
                    images = decoded
                else:
                    images = [np.array(decoded)]
            else:
                images = [decoded]
            parsed_images = []
            for img in images:
                if isinstance(img, (list, tuple)):
                    parsed_images.append(np.array(img))
                elif isinstance(img, np.ndarray):
                    parsed_images.append(img)
                else:
                    try:
                        parsed_images.append(base64_image_to_numpy(img))
                    except Exception:
                        print(f"Failed base64 decode for user_id={user_id}, img_type={type(img).__name__}")
                        if isinstance(decoded, (list, tuple, np.ndarray)):
                            parsed_images.append(np.array(decoded))
                        else:
                            raise
            image_dict.setdefault(user_id, []).extend(parsed_images)
        X, y = [], []
        for user_id, images in image_dict.items():
            print(f"user_id={user_id} parsed_images={len(images)}")
            X.extend(images)
            # Y (labels) are the user ids
            y.extend([user_id] * len(images))
        X = np.array(X)
        y = np.array(y)
        if len(X) > 0:
            sample = X[0]
            print(f"Sample embedding shape: {getattr(sample, 'shape', None)} ndim={getattr(sample, 'ndim', None)}")
        # LabelEncoder is used to convert from user ids to integers (0, 1, 2, ...)
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y)
        return X, y_encoded, label_encoder

    def add_embedding(self, user_id: str, embedding):
        db = DatabaseController(self._db_path)
        return db.add_embedding(user_id, embedding)

    def get_embedding_count(self) -> int:
        db = DatabaseController(self._db_path)
        return len(db.get_embeddings_table())

    def reload_data_from_db(self):
        self.X, self.y, self.label_encoder = self.get_data_from_db(self._db_path)

    def retrain_from_db(self):
        self.reload_data_from_db()
        print(f"Reloaded data from database: X_shape={getattr(self.X, 'shape', None)} y_shape={getattr(self.y, 'shape', None)}")
        if self.y is not None:
            unique_labels = len(set(self.y.tolist())) if hasattr(self.y, "tolist") else "unknown"
            print(f"Unique labels: {unique_labels}")
        if self.X is None or len(self.X) == 0:
            raise ValueError("No embeddings available for training.")
        self.prepare_data()
        self.create_model()
        return self.train_model()

    def prepare_data(self):
        # Prepare data
        res = prepare_data_train_model(
            self.X, self.y, self.label_encoder,
            input_shape=self.INPUT_SHAPE,
            split_strategy=self.SPLIT_STRATEGY,
            test_split_ratio=self.TEST_SPLIT_RATIO,
            validation_split_ratio=self.VALIDATION_SPLIT_RATIO,
            random_state=self.RANDOM_STATE,
            n_train_per_subject=self.N_TRAIN_PER_SUBJECT,
        )
        # Save output
        (self.num_classes,
         self.X_train, self.y_train,
         self.X_test, self.y_test,
         self.X_val, self.y_val,
         self.validation_data) = res

    def create_model(self):
        # Create model
        res = create_model(
            self.num_classes,
            input_shape=self.INPUT_SHAPE,
            model_save_dir=self._model_save_dir,
            log_dir=self._log_dir,
            model_name=self.MODEL_NAME,
            learning_rate=self.LEARNING_RATE,
            arc_embedding_dim=self.ARC_EMBEDDING_DIM,
            arc_margin=self.ARC_MARGIN,
            arc_scale=self.ARC_SCALE,
            early_stopping_patience=self.EARLY_STOPPING_PATIENCE,
        )
        # Save output
        self.model, self.inference_model, self.callbacks, self.model_filepath, self.summary_text = res

    def train_model(self):
        self.duration = time.time()
        # Train Model
        res = train_model(
            self.model,
            self.X_train, self.y_train, self.X_test, self.y_test,
            self.validation_data, self.callbacks,
            self.label_encoder, self.model_filepath,
            model_save_dir=self._model_save_dir,
            model_name=self.MODEL_NAME,
            inference_model=self.inference_model,
            batch_size=self.BATCH_SIZE,
            epochs=self.EPOCHS,
        )
        self.output_train = res
        # End timer
        end_time = time.time()
        self.duration = end_time - self.duration
        return self.output_train


    def predict_image(self, image:np.array):
        return predict_image(image, self._model_save_dir, self.MODEL_NAME, self.INPUT_SHAPE)


def formate_ml_image(
    image: np.array,
    input_shape: int,
    ):
    new_width, new_height, new_channels = input_shape
    if image.ndim == 1:
        expected_len = new_width * new_height * new_channels
        if image.size != expected_len:
            inferred_shape = None
            if new_channels == 1:
                if image.size % new_width == 0:
                    inferred_shape = (new_width, image.size // new_width)
                elif image.size % new_height == 0:
                    inferred_shape = (image.size // new_height, new_height)
                else:
                    side = int(np.sqrt(image.size))
                    if side * side == image.size:
                        inferred_shape = (side, side)
            if inferred_shape is None:
                raise ValueError(
                    f"1D embedding length {image.size} does not match expected "
                    f"image size {expected_len} for input_shape={input_shape}"
                )
            print(
                f"Reshaping 1D embedding of length {image.size} to {inferred_shape} "
                f"before resize to {input_shape}"
            )
            image = image.reshape(*inferred_shape)
        else:
            image = image.reshape(new_width, new_height, new_channels)
    # Change number of channels
    if image.ndim == 2: # add channel dimension
        image = image[..., np.newaxis]
    channels = image.shape[2]
    if channels == 4:
        image = image[..., :3]
        channels = image.shape[2]
    if channels == 3:
        if new_channels == 1: # Convert rgb to grayscale if input_shape asked
            image = convert_to_tensor(image)
            image = rgb_to_grayscale(image).numpy()
    elif channels == 1:
        if new_channels == 3: # Convert grayscale to rgb if input_shape asked
            image = convert_to_tensor(image)
            image = grayscale_to_rgb(image).numpy()
    elif image.shape[2] != 1:
        raise ValueError("Image must be grayscale or RGB.")
    # Resize & normalize image
    image = convert_image_dtype(image, dtype=float32)
    image = resize(image, [new_width, new_height], method="area").numpy()
    return image

def prepare_data_train_model(
    X, y, label_encoder,
    input_shape=(100, 100, 1),
    split_strategy='stratified',
    test_split_ratio=0.2,
    validation_split_ratio=0.15,
    random_state=42,
    n_train_per_subject=7,
    show_logs=False
    ):
    """
    Prepare data for facial recognition model.

    --- Images & labels set & image size
    :param X: dataset (numpy array of images)
    :param y: labels
    :param label_encoder: sklearn.preprocessing._label.LabelEncoder
    :param input_shape:  (width, height, channels) of images.
    --- Data Division Settings ---
    :param split_strategy: Division strategy: 'stratified' or 'fixed_per_subject'
    --- For 'stratified' split_strategy ---
    :param test_split_ratio: Proportion of the total dataset to use for the test set
    :param validation_split_ratio: Proportion of the total dataset to use for the validation set. Will be subtracted from the training set if non-zero.
    --- For 'fixed_per_subject' split_strategy ---
    :param random_state: Seed for reproducibility of divisions and initializations
    :param n_train_per_subject: Exact number of images per subject for the training set. (Ignored if SPLIT_STRATEGY is not 'fixed_per_subject')
    --- Display print logs ---
    :param show_logs:

    :return num_classes, X_train, y_train, X_test, y_test, X_val, y_val, validation_data
    """
    # --- ------------------- ---
    # --- 2. Data Preparation ---
    # --- ------------------- ---

    if X is None or y is None or label_encoder is None:
        raise Exception("No data")

    # Display model parameters
    if show_logs:
        print("Custom configuration loaded:")
        print(f"  - Image Dimensions: {input_shape}")
        print(f"  - Split Strategy: {split_strategy}")
        print("\n--- Prepare data ---")

    # Normalize images in the same shape
    X = np.array([formate_ml_image(img, input_shape) for img in X])

    # Get the total number of classes from the label encoder
    num_classes = len(label_encoder.classes_)
    if show_logs: print(f"Number of classes detected: {num_classes}")

    # --- ---------------- ---
    # --- 3. Data Division ---
    # --- ---------------- ---
    if split_strategy == 'stratified':
        data_splits = data_loader.split_data_stratified(
            X, y,
            test_size=test_split_ratio,
            validation_size=validation_split_ratio,
            random_state=random_state
        )
        X_train = data_splits.get('X_train')
        y_train = data_splits.get('y_train')
        X_val = data_splits.get('X_val')
        y_val = data_splits.get('y_val')
        X_test = data_splits.get('X_test')
        y_test = data_splits.get('y_test')

        if X_val is None and validation_split_ratio > 0 and X_train is not None and len(X_train) > 0:
             val_ratio_from_train = validation_split_ratio / (1.0 - test_split_ratio)
             if val_ratio_from_train < 1.0:
                 if show_logs: print(f"Creation of the validation set from training (ratio: {val_ratio_from_train:.2f})")
                 X_train, X_val, y_train, y_val = train_test_split(
                     X_train, y_train,
                     test_size=val_ratio_from_train,
                     random_state=random_state,
                     stratify=y_train
                 )
             else:
                 print("Warning: Inconsistent split ratios, no training data remaining after validation.")

    elif split_strategy == 'fixed_per_subject':
        X_train_full, X_test, y_train_full, y_test = data_loader.split_data_fixed_per_subject(
            X, y,
            n_train_per_class=n_train_per_subject,
            random_state=random_state
        )
        if validation_split_ratio > 0 and X_train_full is not None and len(X_train_full) > 0:
            if show_logs: print(f"Creation of the validation set from training (ratio: {validation_split_ratio})")
            X_train, X_val, y_train, y_val = train_test_split(
                X_train_full, y_train_full,
                test_size=validation_split_ratio,
                random_state=random_state,
                stratify=y_train_full
            )
        else:
            X_train, y_train = X_train_full, y_train_full
            X_val, y_val = None, None

    else:
        raise Exception(f"Error: Split strategy '{split_strategy}' unrecognized.")

    if X_train is None or len(X_train) == 0:
        raise Exception("Error: No training data available after split.")

    if X_val is None or len(X_val) == 0:
        print("Warning: No validation data available. Training will be done without validation tracking..")
        validation_data = None # `fit` will not use validation
    else:
        validation_data = (X_val, y_val)
        if show_logs: print(f"Final Size - Training: {len(X_train)}, Validation: {len(X_val)}, Test: {len(X_test) if X_test is not None else 0}")

    return num_classes, X_train, y_train, X_test, y_test, X_val, y_val, validation_data


def create_model(
    num_classes,
    input_shape: (int, int),
    model_save_dir='ml_models/trained/',
    log_dir='ml_models/logs/',
    model_name='arcface_yale_anony_v1',
    learning_rate=0.001,
    arc_embedding_dim=128,
    arc_margin=0.35,
    arc_scale=30.0,
    early_stopping_patience=10,
    show_logs=False
    ):
    """
    Create a facial recognition model.

    :param num_classes: generated in prepare_data_train_model()
    :param input_shape: same as in prepare_data_train_model()
    --- Paths & name ---
    :param model_save_dir: Folder to save trained ml_models, label encoder, etc.
    :param log_dir: Folder for TensorBoard logs (optional, leave blank or None to disable)
    :param model_name: Base name for saved files (model, logs, curves)
    --- Training Settings ---
    :param learning_rate: Learning rate for the Adam optimizer
    :param arc_embedding_dim: ArcFace embedding dimension
    :param arc_margin: ArcFace angular margin
    :param arc_scale: ArcFace scale factor
    :param early_stopping_patience: Patience for EarlyStopping (number of epochs without improvement on val_accuracy before stopping). Set to 0 or a negative value to disable EarlyStopping.
    --- Display print logs ---
    :param show_logs: Display training logs

    :return: model, callbacks, model_filepath, summary_text
    """
    # --- ------------------------ ---
    # --- 1. Loading Configuration ---
    # --- ------------------------ ---

    # Display model parameters
    if show_logs:
        print("Custom configuration loaded :")
        print(f"  - Model Name: {model_name}")
        print(f"  - Image Dimensions: {input_shape}")

    # Prepare output & log folder
    os.makedirs(model_save_dir, exist_ok=True)
    if  log_dir:
        os.makedirs(log_dir, exist_ok=True)
        if show_logs: print(f"  - TensorBoard Logs Folder: {log_dir}")

    # --- --------------------- ---
    # --- 4. Model Construction ---
    # --- --------------------- ---
    if show_logs: print("\n--- Model Construction ---")
    model, inference_model = ml_models.build_arcface_cnn(
        input_shape=input_shape,
        num_classes=num_classes,
        embedding_dim=arc_embedding_dim,
        margin=arc_margin,
        scale=arc_scale
    )
    if model is None:
        raise Exception("Critical error while building the model. Stopping.")

    # --- -------------------- ---
    # --- 5. Model Compilation ---
    # --- -------------------- ---
    if show_logs: print("\n--- Compiling the model ---")
    optimizer = Adam(learning_rate=learning_rate)
    model.compile(optimizer=optimizer,
                  loss='sparse_categorical_crossentropy',
                  metrics=['accuracy'])
    if show_logs: print("Model compiled with Adam optimizer.")
    if inference_model is not None:
        inference_model.compile(optimizer=optimizer,
                                loss='sparse_categorical_crossentropy',
                                metrics=['accuracy'])
        if show_logs: print("Inference model compiled with Adam optimizer.")
    model.summary()

    # Capture model summary
    summary_io = io.StringIO()
    model.summary(print_fn=lambda x: summary_io.write(x + "\n"))
    summary_text = summary_io.getvalue()

    # --- ------------------------ ---
    # --- 6. Configuring Callbacks ---
    # --- ------------------------ ---
    if show_logs: print("\n--- Configuring Callbacks ---")
    callbacks = []

    model_filename = f"{model_name}.h5"
    model_filepath = os.path.join(model_save_dir, model_filename)
    if show_logs: print(f"  - ModelCheckpoint: Saving the best model in {model_filepath}")
    checkpoint_callback = ModelCheckpoint(
        filepath=model_filepath,
        monitor='val_accuracy',
        save_best_only=True,
        save_weights_only=False,
        mode='max',
        verbose=1
    )
    callbacks.append(checkpoint_callback)

    # if early_stopping_patience and early_stopping_patience > 0:
    #     if show_logs: print(f"  - EarlyStopping: Activated with patience={early_stopping_patience}")
    #     early_stopping_callback = EarlyStopping(
    #         monitor='val_accuracy',
    #         patience=early_stopping_patience,
    #         mode='max',
    #         restore_best_weights=True,
    #         verbose=1
    #     )
    #     callbacks.append(early_stopping_callback)
    # else:
    #     if show_logs: print("  - EarlyStopping: Disabled.")

    if log_dir:
        tensorboard_log_dir = os.path.join(log_dir, model_name + "_" + time.strftime("%Y%m%d-%H%M%S"))
        if show_logs: print(f"  - TensorBoard: Logs in {tensorboard_log_dir}")
        tensorboard_callback = TensorBoard(
            log_dir=tensorboard_log_dir,
            histogram_freq=1
        )
        callbacks.append(tensorboard_callback)
    else:
        if show_logs: print("  - TensorBoard: Disabled.")

    csv_log_path = os.path.join(model_save_dir, f"{model_name}_training_log.csv")
    if show_logs: print(f"  - CSVLogger: Logs in {csv_log_path}")
    csv_logger_callback = CSVLogger(csv_log_path, append=False)
    callbacks.append(csv_logger_callback)

    return model, inference_model, callbacks, model_filepath, summary_text



def text_to_image(text: str, font_size: int = 28, padding: int = 20):
    font = ImageFont.load_default()
    temp_img = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(temp_img)
    lines = text.split('\n')
    max_width = 0
    line_height = 0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        max_width = max(max_width, w)
        line_height = max(line_height, h)
    img_width = max_width + padding * 4
    img_height = line_height * len(lines) + padding * 4
    img = Image.new("RGB", (img_width, img_height), color="white")
    draw = ImageDraw.Draw(img)
    y = padding
    for line in lines:
        draw.text((padding, y), line, font=font, fill="black")
        y += line_height
    return img

def _draw_accuracy_and_loss_curves2(epochs_range, acc, loss, val_acc=None, val_loss=None):
    plt.figure(figsize=(12, 5))

    plt.subplot(1, 2, 1)
    plt.plot(epochs_range, acc, label='Training Accuracy')
    if val_acc is not None:
        plt.plot(epochs_range, val_acc, label='Validation Accuracy')
    plt.legend(loc='lower right')
    plt.title('Training and Validation Accuracy')
    plt.xlabel('Epochs')
    plt.ylabel('Accuracy')

    plt.subplot(1, 2, 2)
    plt.plot(epochs_range, loss, label='Training Loss')
    if val_loss is not None:
        plt.plot(epochs_range, val_loss, label='Validation Loss')
    plt.legend(loc='upper right')
    plt.title('Training and Validation Loss')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    return plt


def train_model(
    model,
    X_train, y_train, X_test, y_test,
    validation_data, callbacks,
    label_encoder,
    model_filepath,
    model_save_dir='ml_models/trained/',
    model_name='arcface_yale_anony_v1',
    inference_model=None,
    batch_size=32,
    epochs=50,
    show_logs=False
    ):
    """
    Train facial recognition model.

    :param model: from create_model()
    :param X_train: from prepare_data_train_model()
    :param y_train: from prepare_data_train_model()
    :param X_test: from prepare_data_train_model()
    :param y_test: from prepare_data_train_model()
    :param validation_data: from prepare_data_train_model()
    :param callbacks: from create_model()
    :param label_encoder: from get_data_from_db()
    :param model_filepath: from create_model()
    :param model_save_dir: same as in create_model()
    :param model_name: same as in create_model()
    :param inference_model: from create_model()
    --- Training Settings ---
    :param batch_size: Batch size
    :param epochs: Maximum number of training epochs
    --- Display print logs ---
    :param show_logs:

    :return: dict
    """
    # --- ----------------- ---
    # --- 7. Model Training ---
    # --- ----------------- ---

    # Display model parameters
    if show_logs:
        print("Custom configuration loaded:")
        print(f"  - Model Name: {model_name}")
        print(f"  - Epochs: {epochs}, Batch Size: {batch_size}")

    if show_logs: print("\n--- Start training ---")
    train_inputs = [X_train, y_train] if len(model.inputs) == 2 else X_train
    if validation_data is not None:
        val_x, val_y = validation_data
        validation_payload = ([val_x, val_y], val_y) if len(model.inputs) == 2 else (val_x, val_y)
    else:
        validation_payload = None
    try:
        history = model.fit(
            train_inputs, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=validation_payload,
            callbacks=callbacks,
            verbose=(show_logs==True)
        )
        if show_logs: print("--- Training completed ---")

    except Exception as e:
        encoder_save_path = os.path.join(model_save_dir, f"{model_name}_label_encoder.joblib")
        print("\nSaving the label encoder (even if training failed)...")
        data_loader.save_label_encoder(label_encoder, encoder_save_path)
        raise Exception(f"\nError during training: {e}")


    # --- ---------------- ---
    # --- 8. Post-Training ---
    # --- ---------------- ---
    encoder_save_path = os.path.join(model_save_dir, f"{model_name}_label_encoder.joblib")
    if show_logs: print("\n--- Saving the label encoder ---")
    data_loader.save_label_encoder(label_encoder, encoder_save_path)

    # Evaluation
    eval_model = inference_model if inference_model is not None else model
    eval_inputs = X_test if inference_model is not None else ([X_test, y_test] if len(model.inputs) == 2 else X_test)
    if getattr(eval_model, "optimizer", None) is None:
        print("Inference model is not compiled; falling back to training model for eval.")
        eval_model = model
        eval_inputs = [X_test, y_test] if len(model.inputs) == 2 else X_test
    eval_loss, eval_acc = eval_model.evaluate(eval_inputs, y_test)
    y_pred = np.argmax(eval_model.predict(eval_inputs), axis=1)
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=False)

    # Capture report to image
    report = pillow_image_to_bytes(text_to_image(report))

    # Save inference model if it exists (ArcFace)
    if inference_model is not None:
        inference_model_filepath = os.path.join(model_save_dir, f"{model_name}_inference.h5")
        if show_logs: print(f"\n--- Saving inference model ---")
        inference_model.save(inference_model_filepath)
        if show_logs: print(f"Inference model saved in: {inference_model_filepath}")

    if history is not None:
        if show_logs: print("\n--- Displaying learning curves ---")
        try:
            acc = history.history['accuracy']
            loss = history.history['loss']
            val_acc = history.history['val_accuracy'] if validation_data else None
            val_loss = history.history['val_loss'] if validation_data else None
            epochs_range = range(len(acc))

            plt_obj = _draw_accuracy_and_loss_curves2(epochs_range, acc, loss, val_acc, val_loss)
            buf = io.BytesIO()
            plt_obj.savefig(buf, format='png')
            buf.seek(0)
            image_pil = Image.open(buf)

            plot_save_path = os.path.join(model_save_dir, f"{model_name}_training_curves.pdf")
            plt.savefig(plot_save_path, format='pdf', bbox_inches='tight')
            if show_logs: print(f"Curves saved in : {plot_save_path}")
        except Exception as plot_e:
            print(f"Error generating/saving curves: {plot_e}")

    if show_logs:
        print(f"The best model should be saved in : {model_filepath}")
        print(f"The label encoder is saved in : {encoder_save_path}")

    return {
        "curves": image_pil,
        "confusion_matrix": cm,
        "classification_report": report,
        "evaluation": {
            "loss": eval_loss,
            "accuracy": eval_acc
        }
    }


def preprocess_single_image(
    image_array: np.array,
    input_shape,
    ):
    """
    Resizes, normalizes and formats a single image for prediction.
    """
    try:
        image = formate_ml_image(image_array, input_shape)
        # formate_ml_image already returns shape (H, W), add batch dimension only
        image = np.expand_dims(image, axis=0)  # Shape: (1, H, W)
        image = np.expand_dims(image, axis=-1)  # Shape: (1, H, W, 1)
        print(f"Preprocessed image, final shape: {image.shape}")
        return image
    except Exception as e:
        print(f"Error during image preprocessing: {e}")
        return None


def predict_image(
    image_array: np.ndarray,
    model_save_dir: str = 'ml_models/trained/',
    model_name: str = 'arcface_yale_anony_v1',
    input_shape: tuple = (100, 100, 1),
    show_logs = False,
    ):
    """
    Loads the model and encoder, predicts the identity for an image.

    :param image_array: Single image as a NumPy array
    :param model_save_dir: Directory containing the model and encoder
    :param model_name: Base name of the model
    :param input_shape: Tuple (H, W, C) representing the expected size

    :return: predicted label (str)
    """
    # --- ------------------------------- ---
    # --- 1. Load Configuration and Paths ---
    # --- ------------------------------- ---
    if show_logs: print("--- Starting the Prediction Script ---")

    model_filepath = os.path.join(model_save_dir, f"{model_name}.h5")
    encoder_filepath = os.path.join(model_save_dir, f"{model_name}_label_encoder.joblib")
    inference_model_filepath = os.path.join(model_save_dir, f"{model_name}_inference.h5")

    if show_logs:
        print(f"  - Model used: {model_filepath}")
        print(f"  - Encoder used: {encoder_filepath}")
        print(f"  - Inference model used: {inference_model_filepath}")
        print(f"  - Image to predict: NumPy array, shape={image_array.shape}")

    # --- ------------------------- ---
    # --- 2. Load Model and Encoder ---
    # --- ------------------------- ---
    if show_logs: print("\n--- Loading the model and encoder ---")
    if not os.path.exists(model_filepath):
        raise Exception(f"Error: Template file not found: {model_filepath}")
   # Import ArcFace layer for custom_objects if needed
    from mok.models.ml_models import ArcFace, L2Normalize, ZeroLabelsLayer
    custom_objects = {"ArcFace": ArcFace, "L2Normalize": L2Normalize, "ZeroLabelsLayer": ZeroLabelsLayer}

    # Check if inference model exists (ArcFace models use separate inference model)
    if os.path.exists(inference_model_filepath):
        print(f"Using inference model: {inference_model_filepath}")
        model = load_model(inference_model_filepath, custom_objects=custom_objects, safe_mode=False)
    else:
        print(f"Using training model: {model_filepath}")
        print(f"Note: Inference model not found at {inference_model_filepath}")
        model = load_model(model_filepath, custom_objects=custom_objects, safe_mode=False)

    # Load the label encoder
    label_encoder = data_loader.load_label_encoder(encoder_filepath)
    if label_encoder is None:
        raise Exception("Critical error: Unable to load label encoder.")

    # --- ----------------------------- ---
    # --- 3. Preprocess the Input Image ---
    # --- ----------------------------- ---
    if show_logs: print("\n--- Preprocessing of the input image ---")
    preprocessed_image = preprocess_single_image(image_array, input_shape)
    if preprocessed_image is None:
        raise Exception("Image preprocessing failed.")

    # --- ---------------------- ---
    # --- 4. Make the Prediction ---
    # --- ---------------------- ---
    if show_logs: print("\n--- Prediction ---")
    try:
        # Check if model expects 2 inputs (ArcFace training model) or 1 input
        if len(model.inputs) == 2:
            print("Note: Model expects 2 inputs (training model). Inference model not available.")
            print("For better performance, retrain the model to generate the inference model.")
            # For ArcFace training model: pass dummy labels (zeros) for inference
            dummy_labels = np.zeros(preprocessed_image.shape[0], dtype=np.int32)
            prediction_probabilities = model.predict([preprocessed_image, dummy_labels])
        else:
            # Standard model or inference model: single input
            prediction_probabilities = model.predict(preprocessed_image)

        predicted_index = np.argmax(prediction_probabilities[0])
        prediction_confidence = prediction_probabilities[0][predicted_index]

        predicted_label = label_encoder.inverse_transform([predicted_index])[0]
        if show_logs:
            print("\n--- Prediction Result ---")
            print(f"  - Predicted Identity (Subject ID) : {predicted_label}")
            print(f"  - Trust : {prediction_confidence:.4f} ({prediction_confidence*100:.2f}%)")
        return predicted_label, prediction_confidence
    except Exception as e:
        print(f"Error in prediction: {e}")
