import os
import io
import time
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt

from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, TensorBoard, CSVLogger

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report

try:
    import faiss
except Exception:
    faiss = None

from mok.preprocessing.utils_image import pillow_image_to_bytes
import mok.data.data_loader as data_loader
import mok.models.ml_models as ml_models
from mok.persistence.database_controller import DatabaseController


def _get_env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        print(f"Invalid float for {name}={raw!r}, using default {default}")
        return default


def _get_env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"Invalid int for {name}={raw!r}, using default {default}")
        return default


RP_VERSION = os.environ.get("MODEL_RP_VERSION", "rp-v1")
OPENSET_TAU_ABS = _get_env_float("MODEL_OPENSET_TAU_ABS", 0.58)
OPENSET_TAU_MARGIN = _get_env_float("MODEL_OPENSET_TAU_MARGIN", 0.02)
VERIFY_COSINE_THRESHOLD = _get_env_float("MODEL_VERIFY_COSINE_THRESHOLD", 0.52)
VERIFY_COSINE_MARGIN = _get_env_float("MODEL_VERIFY_COSINE_MARGIN", 0.015)
VERIFY_MARGIN_BYPASS_DELTA = _get_env_float("MODEL_VERIFY_MARGIN_BYPASS_DELTA", 0.03)
VERIFY_TOP_M_MIN_SCORE = _get_env_float("MODEL_VERIFY_TOP_M_MIN_SCORE", 0.50)
VERIFY_CENTROID_MIN_SCORE = _get_env_float("MODEL_VERIFY_CENTROID_MIN_SCORE", 0.50)
VERIFY_TEMPLATE_DOMINANCE_MARGIN = _get_env_float("MODEL_VERIFY_TEMPLATE_DOMINANCE_MARGIN", 0.005)
VERIFY_CENTROID_DOMINANCE_MARGIN = _get_env_float("MODEL_VERIFY_CENTROID_DOMINANCE_MARGIN", 0.01)
RETRIEVAL_TOP_K = _get_env_int("MODEL_RETRIEVAL_TOP_K", 80)
RETRIEVAL_NPROBE = _get_env_int("MODEL_RETRIEVAL_NPROBE", 8)
RETRIEVAL_IVF_NLIST = _get_env_int("MODEL_RETRIEVAL_IVF_NLIST", 8)
RETRIEVAL_ANN_OVERFETCH_FACTOR = _get_env_int("MODEL_RETRIEVAL_ANN_OVERFETCH_FACTOR", 8)
IDENTIFY_LABEL_TOP_M = _get_env_int("MODEL_IDENTIFY_LABEL_TOP_M", 3)
VERIFY_TOP_M = _get_env_int("MODEL_VERIFY_TOP_M", 3)


def _atomic_binary_replace(filepath: str, write_func) -> None:
    tmp_path = f"{filepath}.tmp"
    prev_path = f"{filepath}.prev"
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    write_func(tmp_path)
    if os.path.exists(filepath):
        os.replace(filepath, prev_path)
    os.replace(tmp_path, filepath)


def _save_joblib_with_backup(obj, filepath: str) -> None:
    def _writer(tmp_path: str) -> None:
        data_loader.joblib.dump(obj, tmp_path)

    _atomic_binary_replace(filepath, _writer)


def _l2_normalize_rows(vectors: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return vectors / norms


def _load_joblib_with_backup(filepath: str):
    prev_filepath = f"{filepath}.prev"
    if os.path.exists(filepath):
        return data_loader.joblib.load(filepath)
    if os.path.exists(prev_filepath):
        return data_loader.joblib.load(prev_filepath)
    raise FileNotFoundError(f"Artifact not found at {filepath} (or backup {prev_filepath})")


def _save_faiss_index_with_backup(index, filepath: str) -> None:
    if faiss is None:
        return

    def _writer(tmp_path: str) -> None:
        assert faiss is not None
        faiss.write_index(index, tmp_path)

    _atomic_binary_replace(filepath, _writer)


def _load_faiss_index_with_backup(filepath: str):
    if faiss is None:
        return None
    prev_filepath = f"{filepath}.prev"
    if os.path.exists(filepath):
        assert faiss is not None
        return faiss.read_index(filepath)
    if os.path.exists(prev_filepath):
        assert faiss is not None
        return faiss.read_index(prev_filepath)
    return None


def _parse_embedding_payload(raw_value, subject_id: str = "") -> list[np.ndarray]:
    try:
        decoded = json.loads(raw_value)
    except Exception:
        decoded = raw_value

    if not isinstance(decoded, list):
        raise ValueError(
            f"Invalid embedding payload for user_id={subject_id}: expected list, got {type(decoded).__name__}"
        )

    parsed_vectors = []
    if decoded and all(isinstance(item, (int, float)) for item in decoded):
        parsed_vectors.append(np.asarray(decoded, dtype=np.float32))
    elif decoded and all(isinstance(item, (list, tuple)) for item in decoded):
        for item in decoded:
            if not all(isinstance(val, (int, float)) for val in item):
                raise ValueError(f"Non-numeric embedding values for user_id={subject_id}")
            parsed_vectors.append(np.asarray(item, dtype=np.float32))
    else:
        raise ValueError(f"Invalid embedding format for user_id={subject_id}")

    return parsed_vectors


class MLController:

    # Data source & final model
    X, y, label_encoder = None, None, None
    model = None
    duration = 0

    # Paths
    _db_path = os.environ.get("SQLITE_DB_PATH", DatabaseController.DEFAULT_DB_PATH)
    _ml_output = "data/ml_models"
    _model_save_dir = f'{_ml_output}/trained'
    _log_dir = f'{_ml_output}/logs'

    ############# MODEL SETTINGS #############
    #####--- prepare_data_train_model ---#####
    INPUT_SHAPE = (0,)
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
    EPOCHS = 100

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
    vector_input_dim = None

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
            parsed_vectors = _parse_embedding_payload(raw_value, subject_id=str(user_id))
            image_dict.setdefault(user_id, []).extend(parsed_vectors)
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
        train_output = self.train_model()
        retrieval_output = train_retrieval_index(
            X_templates=self.X,
            y_templates=self.y,
            model_save_dir=self._model_save_dir,
            model_name=self.MODEL_NAME,
        )
        train_output["retrieval"] = retrieval_output
        self.output_train = train_output
        return self.output_train

    def prepare_data(self):
        # Prepare data
        res = prepare_data_train_model(
            self.X, self.y, self.label_encoder,
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
         self.validation_data,
         self.vector_input_dim) = res
        self.INPUT_SHAPE = (self.vector_input_dim,)

    def create_model(self):
        if self.vector_input_dim is None:
            raise ValueError("vector_input_dim is not initialized. Call prepare_data() first.")
        vector_input_dim = int(self.vector_input_dim)
        # Create model
        res = create_model(
            self.num_classes,
            vector_input_dim=vector_input_dim,
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
        self.model, self.callbacks, self.model_filepath, self.summary_text = res

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
            batch_size=self.BATCH_SIZE,
            epochs=self.EPOCHS,
        )
        self.output_train = res
        # End timer
        end_time = time.time()
        self.duration = end_time - self.duration
        return self.output_train


    def predict_image(self, vector: np.ndarray, user_id: str = ""):
        if user_id:
            verify_output = verify_claimed_identity(
                vector_array=vector,
                claimed_user_id=user_id,
                db_path=self._db_path,
                model_save_dir=self._model_save_dir,
                model_name=self.MODEL_NAME,
            )
            if verify_output["verified"]:
                return str(user_id), float(verify_output["confidence"])
            return "unknown", 0.0

        prediction_output = identify_image(
            vector_array=vector,
            model_save_dir=self._model_save_dir,
            model_name=self.MODEL_NAME,
        )
        return prediction_output["predicted_label"], float(prediction_output["confidence"])

    def predict_image_details(self, vector: np.ndarray):
        return identify_image(
            vector_array=vector,
            model_save_dir=self._model_save_dir,
            model_name=self.MODEL_NAME,
        )

    def verify_image(self, vector: np.ndarray, user_id: str):
        return verify_claimed_identity(
            vector_array=vector,
            claimed_user_id=user_id,
            db_path=self._db_path,
            model_save_dir=self._model_save_dir,
            model_name=self.MODEL_NAME,
        )


def prepare_data_train_model(
    X, y, label_encoder,
    split_strategy='stratified',
    test_split_ratio=0.2,
    validation_split_ratio=0.15,
    random_state=42,
    n_train_per_subject=7,
    show_logs=False
    ):
    """
    Prepare vector data for ArcFace training.

    --- Vectors & labels ---
    :param X: dataset (numpy array/list of vectors)
    :param y: labels
    :param label_encoder: sklearn.preprocessing._label.LabelEncoder
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

    :return num_classes, X_train, y_train, X_test, y_test, X_val, y_val, validation_data, vector_input_dim
    """
    # --- ------------------- ---
    # --- 2. Data Preparation ---
    # --- ------------------- ---

    if X is None or y is None or label_encoder is None:
        raise Exception("No data")

    # Display model parameters
    if show_logs:
        print("Custom configuration loaded:")
        print(f"  - Split Strategy: {split_strategy}")
        print("\n--- Prepare data ---")

    sample = np.asarray(X[0])
    if sample.ndim != 1:
        raise ValueError(
            f"Expected 1D vectors but got sample shape={getattr(sample, 'shape', None)}"
        )
    vectors = [np.asarray(item, dtype=np.float32).reshape(-1) for item in X]
    dims = {vec.shape[0] for vec in vectors}
    if len(dims) != 1:
        raise ValueError(f"Inconsistent vector lengths in embeddings: {sorted(dims)}")
    vector_input_dim = vectors[0].shape[0]
    X = np.vstack(vectors).astype(np.float32)
    X = _l2_normalize_rows(X)
    if show_logs:
        print(f"Detected vector embeddings. input_dim={vector_input_dim}")

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

    return num_classes, X_train, y_train, X_test, y_test, X_val, y_val, validation_data, vector_input_dim


def create_model(
    num_classes,
    vector_input_dim: int,
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
    Create a vector-based ArcFace model.

    :param num_classes: generated in prepare_data_train_model()
    :param vector_input_dim: length of input vectors
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
        print(f"  - Vector Input Dim: {vector_input_dim}")

    # Prepare output & log folder
    os.makedirs(model_save_dir, exist_ok=True)
    if  log_dir:
        os.makedirs(log_dir, exist_ok=True)
        if show_logs: print(f"  - TensorBoard Logs Folder: {log_dir}")

    # --- --------------------- ---
    # --- 4. Model Construction ---
    # --- --------------------- ---
    if show_logs: print("\n--- Model Construction ---")
    model = ml_models.build_arcface_vector(
        input_dim=vector_input_dim,
        num_classes=num_classes,
        embedding_dim=arc_embedding_dim,
        margin=arc_margin,
        scale=arc_scale,
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
    model.summary()

    # Capture model summary
    summary_io = io.StringIO()
    def _write_summary_line(x: str) -> None:
        summary_io.write(x + "\n")

    model.summary(print_fn=_write_summary_line)
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

    return model, callbacks, model_filepath, summary_text



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
    img = Image.new("RGB", (int(img_width), int(img_height)), color="white")
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


def _retrieval_templates_path(model_save_dir: str, model_name: str) -> str:
    return os.path.join(model_save_dir, f"{model_name}_rp_templates.joblib")


def _retrieval_index_path(model_save_dir: str, model_name: str) -> str:
    return os.path.join(model_save_dir, f"{model_name}_flatip.faiss")


def _safe_inverse_label(label_encoder: LabelEncoder, label_index: int) -> str:
    try:
        return str(label_encoder.inverse_transform([int(label_index)])[0])
    except Exception:
        return "unknown"


def _compute_label_centroids(
    template_vectors: np.ndarray,
    template_labels: np.ndarray,
):
    unique_labels = np.unique(template_labels)
    centroids = []
    centroid_labels = []
    for label_idx in unique_labels:
        label_mask = template_labels == label_idx
        label_vectors = template_vectors[label_mask]
        if label_vectors.size == 0:
            continue
        centroid = np.mean(label_vectors, axis=0)
        centroid_norm = float(np.linalg.norm(centroid))
        if centroid_norm <= 1e-12:
            continue
        centroid = centroid / centroid_norm
        centroids.append(centroid.astype(np.float32))
        centroid_labels.append(int(label_idx))
    if not centroids:
        return np.asarray([], dtype=np.int32), np.empty((0, template_vectors.shape[1]), dtype=np.float32)
    return np.asarray(centroid_labels, dtype=np.int32), np.vstack(centroids).astype(np.float32)


def train_retrieval_index(
    X_templates,
    y_templates,
    model_save_dir='ml_models/trained/',
    model_name='arcface_yale_anony_v1',
    show_logs=False,
):
    """
    Persist RP templates and a FlatIP retrieval index.
    """
    if X_templates is None or y_templates is None or len(X_templates) == 0:
        raise Exception("Retrieval indexing requires non-empty templates.")

    vectors = np.asarray(X_templates, dtype=np.float32)
    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)
    if vectors.ndim != 2:
        raise ValueError(f"Expected 2D template matrix, got shape={vectors.shape}")

    labels = np.asarray(y_templates, dtype=np.int32).reshape(-1)
    if labels.shape[0] != vectors.shape[0]:
        raise ValueError(
            f"Template/label size mismatch: vectors={vectors.shape[0]} labels={labels.shape[0]}"
        )

    vectors = _l2_normalize_rows(vectors)
    os.makedirs(model_save_dir, exist_ok=True)

    templates_payload = {
        "vectors": vectors,
        "labels": labels,
        "rp_version": RP_VERSION,
        "space": "rp",
        "normalized": True,
        "created_at": time.time(),
    }
    templates_path = _retrieval_templates_path(model_save_dir, model_name)
    _save_joblib_with_backup(templates_payload, templates_path)

    index_path = None
    backend = "numpy-flatip"
    if faiss is not None:
        dim = int(vectors.shape[1])
        total = int(vectors.shape[0])
        nlist = max(1, min(int(RETRIEVAL_IVF_NLIST), total))
        quantizer = faiss.IndexFlatIP(dim)
        index = faiss.IndexIVFFlat(quantizer, dim, nlist, faiss.METRIC_INNER_PRODUCT)
        index.train(vectors)
        index.add(vectors)
        if hasattr(index, "nprobe"):
            index.nprobe = max(1, min(int(RETRIEVAL_NPROBE), nlist))
        index_path = _retrieval_index_path(model_save_dir, model_name)
        _save_faiss_index_with_backup(index, index_path)
        backend = "faiss-ivfflat-ip"

    if show_logs:
        print("\n--- Retrieval Index Build ---")
        print(f"Templates saved in: {templates_path}")
        print(f"Backend: {backend}")
        if backend.startswith("faiss"):
            print(f"nlist={int(min(max(1, int(RETRIEVAL_IVF_NLIST)), vectors.shape[0]))} nprobe={int(RETRIEVAL_NPROBE)}")
        if index_path:
            print(f"FAISS index saved in: {index_path}")

    return {
        "templates_path": templates_path,
        "index_path": index_path,
        "backend": backend,
        "template_count": int(vectors.shape[0]),
        "dimension": int(vectors.shape[1]),
        "rp_version": RP_VERSION,
    }


def train_model(
    model,
    X_train, y_train, X_test, y_test,
    validation_data, callbacks,
    label_encoder,
    model_filepath,
    model_save_dir='ml_models/trained/',
    model_name='arcface_yale_anony_v1',
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
    eval_model = model
    eval_inputs = [X_test, y_test] if len(model.inputs) == 2 else X_test
    eval_loss, eval_acc = eval_model.evaluate(eval_inputs, y_test)
    y_pred = np.argmax(eval_model.predict(eval_inputs), axis=1)
    cm = confusion_matrix(y_test, y_pred)
    report_text = str(classification_report(y_test, y_pred, output_dict=False))

    # Capture report to image
    report = pillow_image_to_bytes(text_to_image(report_text))

    image_pil = None
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
        },
        "retrieval": None,
    }


def preprocess_single_vector(
    vector_array: np.ndarray,
    expected_dim: int,
    ):
    """
    Validate and normalize one RP embedding vector from the client.
    """
    try:
        vector = np.asarray(vector_array, dtype=np.float32).reshape(-1)
        if vector.size != expected_dim:
            raise ValueError(
                f"Input vector length {vector.size} does not match expected {expected_dim}"
            )
        norm = float(np.linalg.norm(vector))
        if norm <= 1e-12:
            raise ValueError("Input vector norm is zero")
        vector = vector / norm
        vector = vector.reshape(1, expected_dim)
        return vector
    except Exception as e:
        print(f"Error during vector preprocessing: {e}")
        return None


def _load_retrieval_runtime_artifacts(
    model_save_dir: str,
    model_name: str,
):
    encoder_filepath = os.path.join(model_save_dir, f"{model_name}_label_encoder.joblib")
    label_encoder = data_loader.load_label_encoder(encoder_filepath)
    if label_encoder is None:
        raise Exception("Critical error: Unable to load label encoder.")

    templates_payload = _load_joblib_with_backup(
        _retrieval_templates_path(model_save_dir, model_name)
    )
    template_vectors = np.asarray(templates_payload.get("vectors"), dtype=np.float32)
    template_labels = np.asarray(templates_payload.get("labels"), dtype=np.int32).reshape(-1)
    if template_vectors.ndim != 2 or template_vectors.size == 0:
        raise ValueError("Invalid retrieval templates artifact: vectors must be a non-empty 2D array")
    if template_labels.shape[0] != template_vectors.shape[0]:
        raise ValueError("Invalid retrieval templates artifact: labels size mismatch")

    template_vectors = _l2_normalize_rows(template_vectors)
    centroid_labels, centroid_vectors = _compute_label_centroids(template_vectors, template_labels)

    faiss_index = _load_faiss_index_with_backup(_retrieval_index_path(model_save_dir, model_name))
    if faiss_index is not None and hasattr(faiss_index, "nprobe"):
        faiss_index.nprobe = max(1, int(RETRIEVAL_NPROBE))

    return {
        "label_encoder": label_encoder,
        "template_vectors": template_vectors,
        "template_labels": template_labels,
        "centroid_labels": centroid_labels,
        "centroid_vectors": centroid_vectors,
        "faiss_index": faiss_index,
        "rp_version": str(templates_payload.get("rp_version") or RP_VERSION),
        "space": str(templates_payload.get("space") or "rp"),
    }


def _search_top_k_candidates(
    query_vector_2d: np.ndarray,
    template_vectors: np.ndarray,
    faiss_index,
    top_k: int,
):
    total_templates = int(template_vectors.shape[0])
    if total_templates == 0:
        return np.asarray([], dtype=np.int64), np.asarray([], dtype=np.float32)

    search_k = max(1, min(int(top_k), total_templates))
    query_vector = query_vector_2d.reshape(-1)

    if faiss_index is not None:
        requested = max(1, min(total_templates, int(search_k * max(1, int(RETRIEVAL_ANN_OVERFETCH_FACTOR)))))
        ann_scores, ann_indices = faiss_index.search(query_vector_2d, requested)
        ann_indices = np.asarray(ann_indices[0], dtype=np.int64)
        ann_scores = np.asarray(ann_scores[0], dtype=np.float32)
    else:
        cosine_scores = np.asarray(template_vectors @ query_vector, dtype=np.float32)
        # Exact mode: keep all templates to avoid truncation-induced recall loss.
        full_order = np.argsort(-cosine_scores)
        ann_indices = np.asarray(full_order, dtype=np.int64)
        ann_scores = np.asarray(cosine_scores[full_order], dtype=np.float32)

    valid_mask = ann_indices >= 0
    return ann_indices[valid_mask], ann_scores[valid_mask]


def identify_image(
    vector_array: np.ndarray,
    model_save_dir: str = 'ml_models/trained/',
    model_name: str = 'arcface_yale_anony_v1',
    show_logs=False,
):
    """
    Retrieval-style identification in RP space: FlatIP retrieval then exact cosine rerank.
    """
    try:
        runtime = _load_retrieval_runtime_artifacts(model_save_dir, model_name)
        label_encoder = runtime["label_encoder"]
        template_vectors = runtime["template_vectors"]
        template_labels = runtime["template_labels"]
        centroid_labels = runtime["centroid_labels"]
        centroid_vectors = runtime["centroid_vectors"]
        faiss_index = runtime["faiss_index"]

        expected_dim = int(template_vectors.shape[1])
        preprocessed_vector = preprocess_single_vector(vector_array, expected_dim)
        if preprocessed_vector is None:
            raise Exception("Vector preprocessing failed.")
        query_vector = preprocessed_vector.reshape(-1)

        ann_indices, ann_scores = _search_top_k_candidates(
            query_vector_2d=preprocessed_vector,
            template_vectors=template_vectors,
            faiss_index=faiss_index,
            top_k=max(1, int(RETRIEVAL_TOP_K)),
        )

        if ann_indices.size == 0:
            return {
                "predicted_label": "unknown",
                "confidence": 0.0,
                "decision": "unknown",
                "best_score": 0.0,
                "second_score": 0.0,
                "tau_abs": float(OPENSET_TAU_ABS),
                "tau_margin": float(OPENSET_TAU_MARGIN),
                "top_k": [],
                "rp_version": runtime["rp_version"],
                "space": runtime["space"],
                "retrieval_backend": "faiss-flatip" if faiss_index is not None else "numpy-flatip",
                "nprobe": int(RETRIEVAL_NPROBE),
            }

        candidate_vectors = template_vectors[ann_indices]
        rerank_scores = np.asarray(candidate_vectors @ query_vector, dtype=np.float32)
        rerank_order = np.argsort(-rerank_scores)
        ranked_indices = ann_indices[rerank_order]
        ranked_ann_scores = ann_scores[rerank_order]
        ranked_rerank_scores = rerank_scores[rerank_order]

        label_scores = {}
        label_ann_scores = {}
        label_best_template = {}
        for template_idx, ann_score, exact_score in zip(
            ranked_indices,
            ranked_ann_scores,
            ranked_rerank_scores,
        ):
            label_idx = int(template_labels[int(template_idx)])
            label_scores.setdefault(label_idx, []).append(float(exact_score))
            label_ann_scores.setdefault(label_idx, []).append(float(ann_score))
            if label_idx not in label_best_template:
                label_best_template[label_idx] = int(template_idx)

        template_ranked_labels = sorted(
            [
                (
                    label_idx,
                    float(
                        0.70 * scores[0]
                        + 0.30 * np.mean(scores[: max(1, min(int(IDENTIFY_LABEL_TOP_M), len(scores)))])
                    ),
                )
                for label_idx, scores in (
                    (label_idx, sorted(scores, reverse=True))
                    for label_idx, scores in label_scores.items()
                )
            ],
            key=lambda item: item[1],
            reverse=True,
        )
        template_label_scores = {int(label_idx): float(score) for label_idx, score in template_ranked_labels}
        centroid_label_scores = {}
        if centroid_vectors.size > 0 and centroid_labels.size > 0:
            centroid_scores = np.asarray(centroid_vectors @ query_vector, dtype=np.float32)
            for label_idx, score in zip(centroid_labels.tolist(), centroid_scores.tolist()):
                centroid_label_scores[int(label_idx)] = float(score)

        merged_labels = set(template_label_scores.keys()) | set(centroid_label_scores.keys())
        ranked_labels = sorted(
            [
                (
                    int(label_idx),
                    float(
                        0.55 * template_label_scores.get(int(label_idx), centroid_label_scores.get(int(label_idx), 0.0))
                        + 0.45 * centroid_label_scores.get(int(label_idx), template_label_scores.get(int(label_idx), 0.0))
                    ),
                )
                for label_idx in merged_labels
            ],
            key=lambda item: item[1],
            reverse=True,
        )

        if not ranked_labels:
            return {
                "predicted_label": "unknown",
                "confidence": 0.0,
                "decision": "unknown",
                "best_score": 0.0,
                "second_score": 0.0,
                "tau_abs": float(OPENSET_TAU_ABS),
                "tau_margin": float(OPENSET_TAU_MARGIN),
                "top_k": [],
                "rp_version": runtime["rp_version"],
                "space": runtime["space"],
                "retrieval_backend": "faiss-flatip" if faiss_index is not None else "numpy-flatip",
                "nprobe": int(RETRIEVAL_NPROBE),
            }

        best_label_idx, best_score = ranked_labels[0]
        second_score = float(ranked_labels[1][1]) if len(ranked_labels) > 1 else -1.0
        margin = float(best_score - second_score)
        accepted = (
            float(best_score) >= float(OPENSET_TAU_ABS)
            and margin >= float(OPENSET_TAU_MARGIN)
        )

        top_k_debug = []
        for label_idx, score in ranked_labels[: max(1, min(RETRIEVAL_TOP_K, len(ranked_labels)))]:
            per_label_scores = sorted(label_scores.get(label_idx, [score]), reverse=True)
            top_m = max(1, min(int(IDENTIFY_LABEL_TOP_M), len(per_label_scores)))
            top_k_debug.append(
                {
                    "label": _safe_inverse_label(label_encoder, label_idx),
                    "score": float(score),
                    "best_score": float(per_label_scores[0]),
                    "top_m_mean": float(np.mean(per_label_scores[:top_m])),
                    "centroid_score": float(centroid_label_scores.get(label_idx, per_label_scores[0])),
                    "ann_score": float(max(label_ann_scores.get(label_idx, [per_label_scores[0]]))),
                    "template_index": int(label_best_template.get(label_idx, -1)),
                }
            )

        if accepted:
            predicted_label = _safe_inverse_label(label_encoder, best_label_idx)
            confidence = float(best_score)
            decision = "accepted"
        else:
            predicted_label = "unknown"
            confidence = 0.0
            decision = "unknown"

        output = {
            "predicted_label": str(predicted_label),
            "confidence": float(confidence),
            "decision": decision,
            "best_score": float(best_score),
            "second_score": float(second_score),
            "tau_abs": float(OPENSET_TAU_ABS),
            "tau_margin": float(OPENSET_TAU_MARGIN),
            "top_k": top_k_debug,
            "rp_version": runtime["rp_version"],
            "space": runtime["space"],
            "retrieval_backend": "faiss-flatip" if faiss_index is not None else "numpy-flatip",
            "nprobe": int(RETRIEVAL_NPROBE),
        }

        if show_logs:
            print("\n--- Prediction Result (Retrieval + Rerank) ---")
            print(f"  - Predicted Identity (Subject ID): {output['predicted_label']}")
            print(f"  - Best rerank score: {output['best_score']:.4f}")
            print(f"  - Second rerank score: {output['second_score']:.4f}")
            print(f"  - Decision: {output['decision']}")

        return output

    except Exception as e:
        raise Exception(f"Error in prediction: {e}") from e


def verify_claimed_identity(
    vector_array: np.ndarray,
    claimed_user_id: str,
    db_path: str | None = None,
    model_save_dir: str = 'ml_models/trained/',
    model_name: str = 'arcface_yale_anony_v1',
):
    """
    1:1 verification in RP space using strict cosine threshold.
    """
    resolved_db_path = db_path or os.environ.get("SQLITE_DB_PATH", DatabaseController.DEFAULT_DB_PATH)
    db = DatabaseController(resolved_db_path)
    raw_embeddings = db.get_embeddings_for_subject(str(claimed_user_id))

    claimed_vectors_list = []
    for raw_embedding in raw_embeddings:
        claimed_vectors_list.extend(
            _parse_embedding_payload(raw_embedding, subject_id=str(claimed_user_id))
        )

    if not claimed_vectors_list:
        return {
            "verified": False,
            "confidence": 0.0,
            "claimed_user_id": str(claimed_user_id),
            "best_score": 0.0,
            "threshold": float(VERIFY_COSINE_THRESHOLD),
            "template_count": 0,
            "decision": "unknown_claimed_user",
            "rp_version": RP_VERSION,
            "space": "rp",
        }

    claimed_vectors = np.vstack(claimed_vectors_list).astype(np.float32)
    claimed_vectors = _l2_normalize_rows(claimed_vectors)

    expected_dim = int(claimed_vectors.shape[1])
    preprocessed_vector = preprocess_single_vector(vector_array, expected_dim)
    if preprocessed_vector is None:
        raise Exception("Vector preprocessing failed.")
    query_vector = preprocessed_vector.reshape(-1)

    if claimed_vectors.size == 0:
        return {
            "verified": False,
            "confidence": 0.0,
            "claimed_user_id": str(claimed_user_id),
            "best_score": 0.0,
            "threshold": float(VERIFY_COSINE_THRESHOLD),
            "template_count": 0,
            "decision": "no_claimed_templates",
            "rp_version": RP_VERSION,
            "space": "rp",
        }

    cosine_scores = np.asarray(claimed_vectors @ query_vector, dtype=np.float32)
    sorted_scores = np.sort(cosine_scores)[::-1] if cosine_scores.size > 0 else np.asarray([], dtype=np.float32)
    best_score = float(sorted_scores[0]) if sorted_scores.size > 0 else 0.0
    top_m = max(1, min(int(VERIFY_TOP_M), int(sorted_scores.size) if sorted_scores.size > 0 else 1))
    top_m_mean = float(np.mean(sorted_scores[:top_m])) if sorted_scores.size > 0 else 0.0

    centroid = np.mean(claimed_vectors, axis=0)
    centroid_norm = float(np.linalg.norm(centroid))
    centroid_score = 0.0
    if centroid_norm > 1e-12:
        centroid = centroid / centroid_norm
        centroid_score = float(np.dot(centroid, query_vector))

    # Favor centroid/cohort signals over single-template peaks to reduce noisy nearest-neighbor failures.
    fused_score = float(0.20 * best_score + 0.30 * top_m_mean + 0.50 * centroid_score)

    impostor_best = -1.0
    try:
        runtime = _load_retrieval_runtime_artifacts(model_save_dir, model_name)
        label_encoder = runtime["label_encoder"]
        template_vectors = runtime["template_vectors"]
        template_labels = runtime["template_labels"]
        centroid_labels = runtime["centroid_labels"]
        centroid_vectors = runtime["centroid_vectors"]
        claimed_label_idx = int(label_encoder.transform([str(claimed_user_id)])[0])
        impostor_mask = template_labels != claimed_label_idx
        if np.any(impostor_mask):
            impostor_scores = np.asarray(template_vectors[impostor_mask] @ query_vector, dtype=np.float32)
            if impostor_scores.size > 0:
                impostor_best = float(np.max(impostor_scores))

        impostor_best_centroid = -1.0
        if centroid_vectors.size > 0 and centroid_labels.size > 0:
            centroid_mask = centroid_labels != claimed_label_idx
            if np.any(centroid_mask):
                centroid_impostor_scores = np.asarray(
                    centroid_vectors[centroid_mask] @ query_vector,
                    dtype=np.float32,
                )
                if centroid_impostor_scores.size > 0:
                    impostor_best_centroid = float(np.max(centroid_impostor_scores))
            else:
                impostor_best_centroid = -1.0
        else:
            impostor_best_centroid = -1.0
    except Exception:
        # Verification should still work when retrieval artifacts are missing/outdated.
        impostor_best = -1.0
        impostor_best_centroid = -1.0

    effective_impostor = impostor_best_centroid if impostor_best_centroid >= 0.0 else impostor_best
    margin_to_impostor = float(fused_score - effective_impostor) if effective_impostor >= 0.0 else 1.0
    template_margin_to_impostor = (
        float(best_score - impostor_best) if impostor_best >= 0.0 else 1.0
    )
    centroid_margin_to_impostor = (
        float(centroid_score - impostor_best_centroid) if impostor_best_centroid >= 0.0 else 1.0
    )
    threshold_pass = bool(fused_score >= float(VERIFY_COSINE_THRESHOLD))
    margin_pass = bool(margin_to_impostor >= float(VERIFY_COSINE_MARGIN))
    top_m_floor_pass = bool(top_m_mean >= float(VERIFY_TOP_M_MIN_SCORE))
    centroid_floor_pass = bool(centroid_score >= float(VERIFY_CENTROID_MIN_SCORE))
    template_dominance_pass = bool(
        template_margin_to_impostor >= float(VERIFY_TEMPLATE_DOMINANCE_MARGIN)
    )
    centroid_dominance_pass = bool(
        centroid_margin_to_impostor >= float(VERIFY_CENTROID_DOMINANCE_MARGIN)
    )
    high_confidence_bypass_candidate = bool(
        fused_score >= float(VERIFY_COSINE_THRESHOLD + VERIFY_MARGIN_BYPASS_DELTA)
    )
    verified = bool(
        threshold_pass
        and margin_pass
        and top_m_floor_pass
        and centroid_floor_pass
        and template_dominance_pass
        and centroid_dominance_pass
    )
    if verified:
        decision = "accepted"
    else:
        if not threshold_pass:
            decision = "rejected_below_threshold"
        elif not margin_pass:
            decision = "rejected_low_margin"
        elif not top_m_floor_pass:
            decision = "rejected_low_top_m_mean"
        elif not centroid_floor_pass:
            decision = "rejected_low_centroid_score"
        elif not template_dominance_pass:
            decision = "rejected_impostor_template_too_close"
        elif not centroid_dominance_pass:
            decision = "rejected_impostor_centroid_too_close"
        else:
            decision = "rejected"

    return {
        "verified": verified,
        "confidence": float(fused_score),
        "claimed_user_id": str(claimed_user_id),
        "best_score": float(best_score),
        "top_m_mean": float(top_m_mean),
        "centroid_score": float(centroid_score),
        "impostor_best_score": float(impostor_best),
        "impostor_best_centroid_score": float(impostor_best_centroid),
        "margin_to_impostor": float(margin_to_impostor),
        "template_margin_to_impostor": float(template_margin_to_impostor),
        "centroid_margin_to_impostor": float(centroid_margin_to_impostor),
        "threshold": float(VERIFY_COSINE_THRESHOLD),
        "margin_threshold": float(VERIFY_COSINE_MARGIN),
        "top_m_min_score": float(VERIFY_TOP_M_MIN_SCORE),
        "centroid_min_score": float(VERIFY_CENTROID_MIN_SCORE),
        "template_dominance_margin_threshold": float(VERIFY_TEMPLATE_DOMINANCE_MARGIN),
        "centroid_dominance_margin_threshold": float(VERIFY_CENTROID_DOMINANCE_MARGIN),
        "passes_threshold": bool(threshold_pass),
        "passes_margin": bool(margin_pass),
        "passes_top_m_floor": bool(top_m_floor_pass),
        "passes_centroid_floor": bool(centroid_floor_pass),
        "passes_template_dominance": bool(template_dominance_pass),
        "passes_centroid_dominance": bool(centroid_dominance_pass),
        "margin_bypass_delta": float(VERIFY_MARGIN_BYPASS_DELTA),
        "high_confidence_bypass_candidate": bool(high_confidence_bypass_candidate),
        "template_count": int(claimed_vectors.shape[0]),
        "decision": decision,
        "rp_version": RP_VERSION,
        "space": "rp",
    }
