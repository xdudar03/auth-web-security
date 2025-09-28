import os
import tensorflow as tf
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
import time

# --- Import project modules ---
try:
    from src.modules import data_loader
    from src.face_recognition import ml_models
    try:
        from src import config
    except ImportError:
        print("Error: Unable to import src/config.py.")
        print("Please ensure the file exists and has no syntax errors.")
        exit()

except ImportError as e:
    print(f"Error importing project modules: {e}")
    print("Make sure to run this script from the project root or verify the directory structure is correct.")
    exit()

# --- Main training function ---
def train_model():
    """
    Orchestrates the complete training process of the face recognition model.
    """
    print("--- Starting Training Script ---")
    start_time = time.time()

    # --- 1. Load configuration ---
    print("Configuration loaded from config.py:")
    print(f"  - Data folder: {config.ANONY_IMAGES_PATH}")
    print(f"  - Model save directory: {config.MODEL_SAVE_DIR}")
    print(f"  - Model architecture: {config.MODEL_ARCHITECTURE}")
    print(f"  - Model name: {config.MODEL_NAME}")
    print(f"  - Image dimensions: {config.IMG_HEIGHT}x{config.IMG_WIDTH}x{config.CHANNELS}")
    print(f"  - Split strategy: {config.SPLIT_STRATEGY}")
    print(f"  - Epochs: {config.EPOCHS}, Batch Size: {config.BATCH_SIZE}")

    os.makedirs(config.MODEL_SAVE_DIR, exist_ok=True)
    if hasattr(config, 'LOG_DIR') and config.LOG_DIR:
        os.makedirs(config.LOG_DIR, exist_ok=True)
        print(f"  - TensorBoard logs directory: {config.LOG_DIR}")


    # --- 2. Data loading and preparation ---
    print("\n--- Loading data ---")
    X, y, label_encoder = data_loader.load_anonymized_images_flat(
        data_dir=config.ANONY_IMAGES_PATH,
        img_width=config.IMG_WIDTH,
        img_height=config.IMG_HEIGHT,
        color_mode=config.COLOR_MODE
    )

    if X is None or y is None or label_encoder is None:
        print("Critical error while loading data. Stopping script.")
        return

    num_classes = len(label_encoder.classes_)
    input_shape = (config.IMG_HEIGHT, config.IMG_WIDTH, config.CHANNELS)
    print(f"Number of detected classes: {num_classes}")

    # --- 3. Data splitting ---
    print("\n--- Splitting data ---")
    X_train, y_train = None, None
    X_val, y_val = None, None
    X_test, y_test = None, None

    if config.SPLIT_STRATEGY == 'stratified':
        data_splits = data_loader.split_data_stratified(
            X, y,
            test_size=config.TEST_SPLIT_RATIO,
            validation_size=config.VALIDATION_SPLIT_RATIO,
            random_state=config.RANDOM_STATE
        )
        X_train = data_splits.get('X_train')
        y_train = data_splits.get('y_train')
        X_val = data_splits.get('X_val')
        y_val = data_splits.get('y_val')
        X_test = data_splits.get('X_test')
        y_test = data_splits.get('y_test')

        if X_val is None and config.VALIDATION_SPLIT_RATIO > 0 and X_train is not None and len(X_train) > 0:
             val_ratio_from_train = config.VALIDATION_SPLIT_RATIO / (1.0 - config.TEST_SPLIT_RATIO)
             if val_ratio_from_train < 1.0:
                 print(f"Creating validation set from training (ratio: {val_ratio_from_train:.2f})")
                 X_train, X_val, y_train, y_val = train_test_split(
                     X_train, y_train,
                     test_size=val_ratio_from_train,
                     random_state=config.RANDOM_STATE,
                     stratify=y_train
                 )
             else:
                 print("Warning: Inconsistent split ratios; no training data left after validation.")

    elif config.SPLIT_STRATEGY == 'fixed_per_subject':
        X_train_full, X_test, y_train_full, y_test = data_loader.split_data_fixed_per_subject(
            X, y,
            n_train_per_class=config.N_TRAIN_PER_SUBJECT,
            random_state=config.RANDOM_STATE
        )
        if config.VALIDATION_SPLIT_RATIO > 0 and X_train_full is not None and len(X_train_full) > 0:
            print(f"Creating validation set from training (ratio: {config.VALIDATION_SPLIT_RATIO})")
            X_train, X_val, y_train, y_val = train_test_split(
                X_train_full, y_train_full,
                test_size=config.VALIDATION_SPLIT_RATIO,
                random_state=config.RANDOM_STATE,
                stratify=y_train_full
            )
        else:
            X_train, y_train = X_train_full, y_train_full
            X_val, y_val = None, None

    else:
        print(f"Error: Split strategy '{config.SPLIT_STRATEGY}' not recognized.")
        return

    if X_train is None or len(X_train) == 0:
        print("Error: No training data available after splitting.")
        return
    if X_val is None or len(X_val) == 0:
        print("Warning: No validation data available. Training will proceed without validation.")
        validation_data = None # `fit` will not use validation
    else:
        validation_data = (X_val, y_val)
        print(f"Final sizes - Train: {len(X_train)}, Validation: {len(X_val)}, Test: {len(X_test) if X_test is not None else 0}")


    # --- 4. Model construction ---
    print("\n--- Building model ---")
    model = None
    if config.MODEL_ARCHITECTURE == 'simple_cnn':
        model = ml_models.build_simple_cnn(input_shape=input_shape, num_classes=num_classes)
    elif config.MODEL_ARCHITECTURE.startswith('transfer_'):
        base_name = getattr(config, 'TRANSFER_BASE_MODEL_NAME', 'MobileNetV2')
        freeze = getattr(config, 'TRANSFER_FREEZE_BASE', True)
        print(f"Using base model: {base_name}, Freeze: {freeze}")
        model = ml_models.build_transfer_model(input_shape=input_shape,
                                               num_classes=num_classes,
                                               base_model_name=base_name,
                                               freeze_base=freeze)
    else:
        print(f"Error: Model architecture not recognized in config: {config.MODEL_ARCHITECTURE}")
        return

    if model is None:
        print("Critical error while building the model. Stopping.")
        return

    # --- 5. Model compilation ---
    print("\n--- Compiling model ---")
    optimizer = tf.keras.optimizers.Adam(learning_rate=config.LEARNING_RATE)
    model.compile(optimizer=optimizer,
                  loss='sparse_categorical_crossentropy',
                  metrics=['accuracy'])
    print("Model compiled with Adam optimizer.")
    model.summary()

    # --- 6. Callback configuration ---
    print("\n--- Configuring callbacks ---")
    callbacks = []

    model_filename = f"{config.MODEL_NAME}.h5"
    model_filepath = os.path.join(config.MODEL_SAVE_DIR, model_filename)
    print(f"  - ModelCheckpoint: Saving best model to {model_filepath}")
    checkpoint_callback = tf.keras.callbacks.ModelCheckpoint(
        filepath=model_filepath,
        monitor='val_accuracy',
        save_best_only=True,
        save_weights_only=False,
        mode='max',
        verbose=1
    )
    callbacks.append(checkpoint_callback)

    if hasattr(config, 'EARLY_STOPPING_PATIENCE') and config.EARLY_STOPPING_PATIENCE > 0:
        print(f"  - EarlyStopping: Enabled with patience={config.EARLY_STOPPING_PATIENCE}")
        early_stopping_callback = tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=config.EARLY_STOPPING_PATIENCE,
            mode='max',
            restore_best_weights=True,
            verbose=1
        )
        callbacks.append(early_stopping_callback)
    else:
        print("  - EarlyStopping: Disabled.")


    if hasattr(config, 'LOG_DIR') and config.LOG_DIR:
        tensorboard_log_dir = os.path.join(config.LOG_DIR, config.MODEL_NAME + "_" + time.strftime("%Y%m%d-%H%M%S"))
        print(f"  - TensorBoard: Logs in {tensorboard_log_dir}")
        tensorboard_callback = tf.keras.callbacks.TensorBoard(
            log_dir=tensorboard_log_dir,
            histogram_freq=1
        )
        callbacks.append(tensorboard_callback)
    else:
        print("  - TensorBoard: Disabled.")

    csv_log_path = os.path.join(config.MODEL_SAVE_DIR, f"{config.MODEL_NAME}_training_log.csv")
    print(f"  - CSVLogger: Logs at {csv_log_path}")
    csv_logger_callback = tf.keras.callbacks.CSVLogger(csv_log_path, append=False)
    callbacks.append(csv_logger_callback)


    # --- 7. Model training ---
    print("\n--- Starting training ---")
    history = None
    try:
        history = model.fit(
            X_train, y_train,
            epochs=config.EPOCHS,
            batch_size=config.BATCH_SIZE,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=1
        )
        print("--- Training finished ---")

    except Exception as e:
        print(f"\nError during training: {e}")
        encoder_save_path = os.path.join(config.MODEL_SAVE_DIR, f"{config.MODEL_NAME}_label_encoder.joblib")
        print("\nSaving the label encoder (even if training failed)...")
        data_loader.save_label_encoder(label_encoder, encoder_save_path)
        return # Stop the script here


    # --- 8. Post-training ---
    encoder_save_path = os.path.join(config.MODEL_SAVE_DIR, f"{config.MODEL_NAME}_label_encoder.joblib")
    print("\n--- Saving the label encoder ---")
    data_loader.save_label_encoder(label_encoder, encoder_save_path)

    if history is not None:
        print("\n--- Displaying learning curves ---")
        try:
            acc = history.history['accuracy']
            loss = history.history['loss']
            epochs_range = range(len(acc))

            plt.figure(figsize=(12, 5))

            plt.subplot(1, 2, 1)
            plt.plot(epochs_range, acc, label='Training Accuracy')
            if validation_data: # Only if validation exists
                 val_acc = history.history['val_accuracy']
                 plt.plot(epochs_range, val_acc, label='Validation Accuracy')
            plt.legend(loc='lower right')
            plt.title('Training and Validation Accuracy')
            plt.xlabel('Epochs')
            plt.ylabel('Accuracy')

            plt.subplot(1, 2, 2)
            plt.plot(epochs_range, loss, label='Training Loss')
            if validation_data: # Only if validation exists
                val_loss = history.history['val_loss']
                plt.plot(epochs_range, val_loss, label='Validation Loss')
            plt.legend(loc='upper right')
            plt.title('Training and Validation Loss')
            plt.xlabel('Epochs')
            plt.ylabel('Loss')

            plot_save_path = os.path.join(config.MODEL_SAVE_DIR, f"{config.MODEL_NAME}_training_curves.pdf")
            plt.savefig(plot_save_path, format='pdf', bbox_inches='tight')
            print(f"Curves saved to: {plot_save_path}")

        except Exception as plot_e:
            print(f"Error generating/saving curves: {plot_e}")


    end_time = time.time()
    duration = end_time - start_time
    print(f"\n--- Training script finished in {duration:.2f} seconds ---")
    print(f"The best model should be saved at: {model_filepath}")
    print(f"The label encoder is saved at: {encoder_save_path}")


# --- Script entry point ---
if __name__ == "__main__":
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.py')
    if not os.path.exists(config_path):
         print(f"Error: The configuration file '{config_path}' was not found.")
         print("Please create this file and define the required parameters.")
    else:
        train_model()