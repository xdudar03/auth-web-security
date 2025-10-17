from tensorflow.keras import layers, models, applications
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

    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_1")(model_input)
    x = layers.BatchNormalization(name="bn1_1")(x)
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same', name="conv1_2")(x)
    x = layers.BatchNormalization(name="bn1_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool1")(x)
    x = layers.Dropout(0.25, name="drop1")(x)

    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same', name="conv2_1")(x)
    x = layers.BatchNormalization(name="bn2_1")(x)
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same', name="conv2_2")(x)
    x = layers.BatchNormalization(name="bn2_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool2")(x)
    x = layers.Dropout(0.25, name="drop2")(x)

    # Dense part (classification)
    x = layers.Flatten(name="flatten")(x)
    x = layers.Dense(128, activation='relu', name="dense1")(x)
    x = layers.BatchNormalization(name="bn_dense1")(x)
    x = layers.Dropout(0.5, name="drop_dense1")(x)

    # Output layer
    model_output = layers.Dense(num_classes, activation='softmax', name="output_softmax")(x)

    # Create the final model
    model = models.Model(inputs=model_input, outputs=model_output, name="simple_cnn")

    print("Simple CNN model built.")
    return model


def build_transfer_model(
    input_shape: Tuple[int, int, int],
    num_classes: int,
    base_model_name: str = 'MobileNetV2',
    freeze_base: bool = True
) -> Optional[models.Model]:
    """
    Builds a model based on transfer learning.

    Loads a pre-trained ImageNet model, removes its classification head,
    optionally freezes its weights, and adds a new classification head.

    Args:
        input_shape: Tuple indicating the input image shape (height, width, channels).
                     MUST be compatible with the chosen base model.
        num_classes: Number of output classes.
        base_model_name: Name of the base model to load from tf.keras.applications.
        freeze_base: If True, freezes the base model's weights during initial training.

    Returns:
        A compilable Keras model, or None if the base model name is invalid.
    """
    print(f"Building transfer model with base={base_model_name}, input_shape={input_shape}, num_classes={num_classes}")

    if input_shape[-1] != 3:
        print(f"Warning: The base model '{base_model_name}' typically expects 3 input channels (RGB), "
              f"but input_shape is {input_shape}. Make sure your data is loaded in RGB.")

    try:
        if base_model_name == 'MobileNetV2':
            base_model = applications.MobileNetV2(input_shape=input_shape, include_top=False, weights='imagenet')
        elif base_model_name == 'ResNet50':
            base_model = applications.ResNet50(input_shape=input_shape, include_top=False, weights='imagenet')
        elif base_model_name == 'EfficientNetB0':
             base_model = applications.EfficientNetB0(input_shape=input_shape, include_top=False, weights='imagenet')
        else:
            print(f"Error: Base model '{base_model_name}' not recognized or not implemented here.")
            return None
    except ValueError as e:
         print(f"Error while loading base model '{base_model_name}' with input_shape {input_shape}: {e}")
         print("Verify that the image size is compatible with the chosen model (e.g., MobileNetV2 >= 32x32, ResNet50 >= 32x32, EfficientNet >= 32x32).")
         return None
    except Exception as e:
         print(f"Unexpected error while loading the base model: {e}")
         return None


    print(f"Base model '{base_model_name}' loaded.")

    if freeze_base:
        base_model.trainable = False
        print("Base model weights frozen.")
    else:
        base_model.trainable = True
        print("Base model weights NOT frozen (fine-tuning mode).")

    model_input = base_model.input

    x = base_model.output
    x = layers.GlobalAveragePooling2D(name="global_avg_pool")(x)
    x = layers.Dense(128, activation='relu', name="dense_head_1")(x)
    x = layers.Dropout(0.5, name="dropout_head")(x)
    model_output = layers.Dense(num_classes, activation='softmax', name="output_softmax")(x)

    model = models.Model(inputs=model_input, outputs=model_output, name=f"transfer_{base_model_name}")

    print(f"Transfer model '{model.name}' built.")
    return model
