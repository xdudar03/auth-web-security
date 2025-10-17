import os
import numpy as np
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

from src.config import IMAGE_SIZE

class EigenfaceGenerator:
    """
    Generates eigenfaces from a set of images using Principal Component Analysis (PCA).

    Args:
        images (np.ndarray): 2D array (number of images x flattened image size).
        n_components (int, optional): Number of principal components (eigenfaces) to generate. Default: 5.
    """
    def __init__(self, images: np.ndarray, n_components: int = 5) -> None:
        if not isinstance(images, np.ndarray) or images.ndim != 2:
            raise ValueError("`images` must be a 2D NumPy array (num_images x flattened_size).")
        self.images = images
        self.n_components = n_components if n_components is not None else min(images.shape)
        self.pca = None
        self.eigenfaces = None
        self.mean_face = None
        self.image_shape = IMAGE_SIZE  # Use size defined in config
        self.original_data = None  # For potential reconstruction

    def generate(self) -> None:
        """Runs PCA to generate eigenfaces."""
        if not self.images.any():
            raise ValueError("No image data provided.")
        if self.images.shape[0] < 2:
            raise ValueError("At least two images are required to generate eigenfaces.")

        self.original_data = self.images
        self.pca = PCA(n_components=self.n_components)
        self.pca.fit(self.images)
        self.eigenfaces = [component.reshape(self.image_shape) for component in self.pca.components_]
        self.mean_face = self.pca.mean_.reshape(self.image_shape)

    def get_eigenfaces(self) -> list:
        """Returns the list of generated eigenfaces."""
        if self.eigenfaces is None:
            self.generate()
        return self.eigenfaces

    def get_mean_face(self) -> np.ndarray:
        """Returns the computed mean face image."""
        if self.mean_face is None:
            self.generate()
        return self.mean_face

    def get_pca_object(self) -> PCA:
        """Returns the PCA object used for the decomposition."""
        if self.pca is None:
            self.generate()
        return self.pca

    def reconstruct_image(self, projected_data: np.ndarray) -> np.ndarray:
        """
        Reconstructs an image from its projection onto the eigenface subspace.

        Args:
            projected_data (np.ndarray): Coefficients in the eigenface space.

        Returns:
            np.ndarray: Reconstructed (flattened) image.
        """
        if self.pca is None:
            raise ValueError("Eigenfaces must be generated before reconstruction.")
        if projected_data.ndim == 1:
            projected_data = projected_data.reshape(1, -1)
        return self.pca.inverse_transform(projected_data)

    def plot_eigenfaces(self, output_folder: str, subject, filename: str = "eigenfaces", show_plot: bool = False) -> None:
        """
        Displays and saves the generated eigenfaces.

        Args:
            output_folder (str): Folder where the figure will be saved.
            subject (int or str): Subject identifier for the filename.
            filename (str, optional): Base filename. Default: "eigenfaces".
            show_plot (bool, optional): Display the figure. Default: False.
        """
        if self.eigenfaces is None:
            self.generate()

        if not os.path.exists(output_folder):
            os.makedirs(output_folder)

        plt.figure(figsize=(12, 6))
        num_eigenfaces = len(self.eigenfaces)
        cols = (num_eigenfaces + 1) // 2  # Compute number of columns
        for i, eigenface in enumerate(self.eigenfaces):
            plt.subplot(2, cols, i + 1)
            plt.imshow(eigenface, cmap='gray')
            plt.title(f'Eigenface {i + 1}')
            plt.axis('off')
        plt.tight_layout()
        plt.savefig(os.path.join(output_folder, f"{filename}_{subject}.png"))
        if show_plot:
            plt.show()
        plt.close()

    def plot_mean_face(self, output_folder: str, subject, show_plot: bool = False) -> None:
        """
        Displays and saves the mean face image.

        Args:
            output_folder (str): Output folder.
            subject (int or str): Subject identifier for the filename.
            show_plot (bool, optional): Display the figure. Default: False.
        """
        if self.mean_face is None:
            self.generate()

        if not os.path.exists(output_folder):
            os.makedirs(output_folder)

        plt.figure()
        plt.imshow(self.mean_face, cmap='gray')
        plt.title("Mean face")
        plt.axis('off')
        plt.savefig(os.path.join(output_folder, f"mean_face_{subject}.png"))
        if show_plot:
            plt.show()
        plt.close()

    def plot_explained_variance(self, output_folder: str, show_plot: bool = False) -> None:
        """
        Plots and saves the cumulative explained variance by component.

        Args:
            output_folder (str): Output folder.
            show_plot (bool, optional): Display the figure. Default: False.
        """
        if self.pca is None:
            self.generate()

        if not os.path.exists(output_folder):
            os.makedirs(output_folder)

        plt.figure()
        plt.plot(np.cumsum(self.pca.explained_variance_ratio_))
        plt.xlabel("Number of components")
        plt.ylabel("Cumulative explained variance")
        plt.title('Explained Variance Ratio')
        plt.savefig(os.path.join(output_folder, "explained_variance.png"))
        if show_plot:
            plt.show()
        plt.close()
