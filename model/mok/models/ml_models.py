from typing import Optional

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


def build_arcface_vector(
    input_dim: int,
    num_classes: int,
    embedding_dim: int = 128,
    margin: float = 0.25,
    scale: float = 64.0
) -> models.Model:
    """
    Builds an ArcFace model that consumes precomputed feature vectors.

    Args:
        input_dim: Length of input feature vector.
        num_classes: Number of output classes.
        embedding_dim: Size of learned embedding before ArcFace head.
        margin: ArcFace angular margin.
        scale: ArcFace scale factor.

    Returns:
        Training model.
    """
    print(
        "Building ArcFace vector model with "
        f"input_dim={input_dim}, num_classes={num_classes}, margin={margin}"
    )

    feature_input = layers.Input(shape=(input_dim,), name="input_features")
    label_input = layers.Input(shape=(), dtype="int32", name="input_label")

    x = layers.GaussianNoise(0.02, name="noise_input")(feature_input)
    x = layers.Dense(512, activation="relu", kernel_regularizer=l2(1e-4), name="dense1")(x)
    x = layers.BatchNormalization(name="bn1")(x)
    x = layers.Dropout(0.35, name="drop1")(x)
    x = layers.Dense(256, activation="relu", kernel_regularizer=l2(1e-4), name="dense2")(x)
    x = layers.BatchNormalization(name="bn2")(x)
    x = layers.Dropout(0.25, name="drop2")(x)

    x = layers.Dense(
        embedding_dim,
        use_bias=False,
        name="embedding",
        kernel_regularizer=l2(1e-4),
    )(x)
    x = layers.BatchNormalization(name="bn_embedding")(x)
    x = L2Normalize(name="embedding_norm")(x)

    arcface_logits = ArcFace(
        num_classes=num_classes,
        margin=margin,
        scale=scale,
        weight_regularizer=l2(1e-4),
        name="arcface_logits",
    )([x, label_input])
    model_output = layers.Softmax(name="output_softmax")(arcface_logits)
    training_model = models.Model(
        inputs=[feature_input, label_input],
        outputs=model_output,
        name="arcface_vector_train",
    )

    print("ArcFace vector training model built.")
    return training_model