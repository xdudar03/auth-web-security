from tensorflow.keras import layers, models, applications
from tensorflow.keras.regularizers import l2
from typing import Tuple, Optional

def build_simple_cnn(input_shape: Tuple[int, int, int], num_classes: int) -> models.Model:
    """
    Builds a simple CNN model for image classification.

    Args:
        input_shape: Tuple indicating the input image shape (height, width, channels).
                     Example: (64, 64, 1) for grayscale, (64, 64, 3) for RGB.
        num_classes: Number of output classes (number of unique subjects).

    Returns:
        A compilable Keras model.
    """
    print(f"Building simple CNN model with input_shape={input_shape} and num_classes={num_classes}")

    model_input = layers.Input(shape=input_shape, name="input_image")
    
    # Robustness to anonymization noise - add noise to make model robust to k-same-pixel artifacts
    x = layers.GaussianNoise(0.03, name="noise_input")(model_input)

    # First block with L2 regularization
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_1", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn1_1")(x)
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_2", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn1_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool1")(x)
    x = layers.Dropout(0.3, name="drop1")(x)

    # Second block with L2 regularization
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same', name="conv2_1", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn2_1")(x)
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same', name="conv2_2", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn2_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool2")(x)
    x = layers.Dropout(0.3, name="drop2")(x)

    # Dense part (classification) with L2 regularization
    x = layers.Flatten(name="flatten")(x)
    x = layers.Dense(128, activation='relu', name="dense1", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn_dense1")(x)
    x = layers.Dropout(0.5, name="drop_dense1")(x)

    # Output layer with L2 regularization
    model_output = layers.Dense(num_classes, activation='softmax', name="output_softmax", kernel_regularizer=l2(1e-4))(x)
    # Create the final model
    model = models.Model(inputs=model_input, outputs=model_output, name="simple_cnn")

    print("Simple CNN model built.")
    return model