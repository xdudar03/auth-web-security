import numpy as np
from functools import reduce
import operator


class NoiseGenerator:
    """
    Adds Laplacian noise to images (or projections) to ensure differential privacy.

    Args:
        eigenfaces_images (list or np.ndarray): Images or projections onto eigenfaces.
        epsilon (float): Privacy parameter (epsilon).

    Attributes:
        eigenfaces (np.ndarray): Input data converted to a NumPy array.
        epsilon (float): Privacy parameter.
        img_shape (tuple): Dimensions of an image.
        img_size (int): Flattened size of an image.
        nb_images (int): Number of images.
        eigenfaces_normalized (np.ndarray): Normalized images.
        noised_eigenfaces (np.ndarray): Images after noise has been added.
    """

    def __init__(self, eigenfaces_images, epsilon: float) -> None:
        if not isinstance(eigenfaces_images, (list, np.ndarray)):
            raise TypeError("`eigenfaces_images` must be a list or a NumPy array.")
        if not isinstance(epsilon, (int, float)):
            raise TypeError("epsilon must be a number.")
        if epsilon <= 0:
            raise ValueError("epsilon must be greater than 0.")

        self.eigenfaces = np.array(eigenfaces_images)
        self.epsilon = epsilon

        if self.eigenfaces.ndim > 2:
            self.img_shape = self.eigenfaces[0].shape
            self.img_size = reduce(operator.mul, self.img_shape)
            self.nb_images = len(self.eigenfaces)
            self.is_projection = False
        elif self.eigenfaces.ndim == 2:
            self.img_shape = None
            self.img_size = self.eigenfaces.shape[1]
            self.nb_images = self.eigenfaces.shape[0]
            self.is_projection = True
        else:
            raise ValueError("`eigenfaces_images` has an unsupported number of dimensions.")

        self.eigenfaces_normalized = None
        self.noised_eigenfaces = None

    def flatten_images(self) -> None:
        """Flattens images if they are not already."""
        if not self.is_projection:
            self.eigenfaces = self.eigenfaces.reshape(self.nb_images, self.img_size)

    def normalize_images(self) -> None:
        """Normalizes images to the [0, 1] range."""
        images_copy = self.eigenfaces.copy()
        if self.is_projection:
            self.eigenfaces_normalized = self._normalize(images_copy)
        else:
            self.eigenfaces_normalized = np.array([self._normalize(img) for img in images_copy])

    def _normalize(self, image: np.ndarray) -> np.ndarray:
        """
        Normalizes an image or projection.

        Args:
            image (np.ndarray): Image to normalize.

        Returns:
            np.ndarray: Normalized image.
        """
        min_val = np.min(image)
        max_val = np.max(image)
        if max_val - min_val == 0:
            return np.zeros_like(image)
        return (image - min_val) / (max_val - min_val)

    def add_laplace_noise(self, sensitivity: float) -> None:
        """
        Adds Laplacian noise to normalized images.

        Args:
            sensitivity (float): Query sensitivity.
        """
        if self.eigenfaces_normalized is None:
            self.normalize_images()
        if not isinstance(sensitivity, (int, float)):
            raise TypeError("Sensitivity must be a number.")
        if sensitivity <= 0:
            raise ValueError("Sensitivity must be > 0")
        scale = sensitivity / self.epsilon
        noise = np.random.laplace(loc=0, scale=scale, size=self.eigenfaces_normalized.shape)
        self.noised_eigenfaces = self.eigenfaces_normalized + noise

    def get_noised_eigenfaces(self) -> np.ndarray:
        """
        Returns the images with added noise.

        Returns:
            np.ndarray: Noisy images.
        """
        if self.noised_eigenfaces is None:
            raise ValueError("Noise has not been added yet. Please call add_laplace_noise().")
        return self.noised_eigenfaces
