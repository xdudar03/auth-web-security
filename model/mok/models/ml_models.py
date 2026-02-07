from typing import Tuple, Optional

import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.regularizers import l2

class ArcFace(layers.Layer):
    def __init__(
        self,
        num_classes: int,
        margin: float = 0.5,
        scale: float = 64.0,
        weight_regularizer: Optional[tf.keras.regularizers.Regularizer] = None,
        **kwargs
    ) -> None:
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.margin = margin
        self.scale = scale
        self.weight_regularizer = weight_regularizer

    def build(self, input_shape) -> None:
        embedding_dim = int(input_shape[0][-1])
        self.class_weights = self.add_weight(
            name="class_weights",
            shape=(embedding_dim, self.num_classes),
            initializer="glorot_uniform",
            regularizer=self.weight_regularizer,
            trainable=True
        )
        super().build(input_shape)

    def call(self, inputs, training=None):
        embeddings, labels = inputs
        embeddings = tf.nn.l2_normalize(embeddings, axis=1)
        weights = tf.nn.l2_normalize(self.class_weights, axis=0)

        cosine = tf.matmul(embeddings, weights)
        cosine = tf.clip_by_value(cosine, -1.0 + 1e-7, 1.0 - 1e-7)

        # If labels are None or training is False, return plain cosine similarity (inference)
        if training is False or labels is None:
            return cosine * self.scale

        labels = tf.cast(labels, tf.int32)
        one_hot = tf.one_hot(labels, depth=self.num_classes)

        theta = tf.acos(cosine)
        target_cosine = tf.cos(theta + self.margin)
        logits = tf.where(one_hot == 1, target_cosine, cosine)
        logits = logits * self.scale
        return logits

    def get_config(self):
        config = super().get_config()
        config.update(
            {
                "num_classes": self.num_classes,
                "margin": self.margin,
                "scale": self.scale,
                "weight_regularizer": tf.keras.regularizers.serialize(self.weight_regularizer),
            }
        )
        return config


class L2Normalize(layers.Layer):
    """L2 normalization layer to replace Lambda layer."""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    
    def call(self, inputs):
        return tf.nn.l2_normalize(inputs, axis=1)
    
    def get_config(self):
        return super().get_config()


class ZeroLabelsLayer(layers.Layer):
    """Generates zero labels for inference."""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
    
    def call(self, inputs):
        batch_size = tf.shape(inputs)[0]
        return tf.zeros(batch_size, dtype=tf.int32)
    
    def get_config(self):
        return super().get_config()


def build_arcface_cnn(
    input_shape: Tuple[int, int, int],
    num_classes: int,
    embedding_dim: int = 128,
    margin: float = 0.25,
    scale: float = 64.0
) -> Tuple[models.Model, models.Model]:
    """
    Builds a CNN model with ArcFace head for image classification.

    Args:
        input_shape: Tuple indicating the input image shape (height, width, channels).
        num_classes: Number of output classes.
        embedding_dim: Size of the feature embedding.
        margin: ArcFace angular margin (in radians). Default: 0.25 (smaller than standard 0.5).
        scale: ArcFace scale factor.

    Returns:
        Tuple of (training_model, inference_model).
        - training_model: Takes [image, label] inputs; for model.fit() with labels during training.
        - inference_model: Takes image input only; for evaluation and inference.
    """
    print(
        "Building ArcFace CNN model with "
        f"input_shape={input_shape}, num_classes={num_classes}, margin={margin}"
    )

    model_input = layers.Input(shape=input_shape, name="input_image")
    label_input = layers.Input(shape=(), dtype="int32", name="input_label")

    x = layers.GaussianNoise(0.03, name="noise_input")(model_input)

    x = layers.Conv2D(32, (3, 3), activation="relu", padding="same", name="conv1_1", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn1_1")(x)
    x = layers.Conv2D(32, (3, 3), activation="relu", padding="same", name="conv1_2", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn1_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool1")(x)
    x = layers.Dropout(0.3, name="drop1")(x)

    x = layers.Conv2D(64, (3, 3), activation="relu", padding="same", name="conv2_1", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn2_1")(x)
    x = layers.Conv2D(64, (3, 3), activation="relu", padding="same", name="conv2_2", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn2_2")(x)
    x = layers.MaxPooling2D((2, 2), name="pool2")(x)
    x = layers.Dropout(0.3, name="drop2")(x)

    x = layers.Flatten(name="flatten")(x)
    x = layers.Dense(embedding_dim, use_bias=False, name="embedding", kernel_regularizer=l2(1e-4))(x)
    x = layers.BatchNormalization(name="bn_embedding")(x)
    x = L2Normalize(name="embedding_norm")(x)

    # Training model: uses ArcFace with margin
    arcface_logits = ArcFace(
        num_classes=num_classes,
        margin=margin,
        scale=scale,
        weight_regularizer=l2(1e-4),
        name="arcface_logits"
    )([x, label_input])
    model_output = layers.Softmax(name="output_softmax")(arcface_logits)

    training_model = models.Model(
        inputs=[model_input, label_input],
        outputs=model_output,
        name="arcface_cnn_train"
    )

    # Inference model: passes zero labels (no margin applied)
    zero_labels = ZeroLabelsLayer()(model_input)
    inference_output = ArcFace(
        num_classes=num_classes,
        margin=margin,
        scale=scale,
        weight_regularizer=l2(1e-4),
        name="arcface_logits"
    )([x, zero_labels])
    inference_output = layers.Softmax(name="output_softmax")(inference_output)

    inference_model = models.Model(
        inputs=model_input,
        outputs=inference_output,
        name="arcface_cnn_infer"
    )

    print("ArcFace CNN models built (training + inference).")
    return training_model, inference_model