import math
import numpy as np
import os
from typing import List, Optional, Tuple
from PIL import Image, ImageFilter
import matplotlib.pyplot as plt
from mok.preprocessing.utils_image import (
    pillow_image_to_bytes,
    numpy_image_to_pillow,
)


class DPSVDAnonymizer:
    """
    Differentially Private SVD-based image anonymizer (DP-SVD)
    inspired by DP-Shield (Fan et al., 2022).

    Args:
        epsilon (float): Privacy parameter (smaller = stronger noise).
        n_singular_values (int): Number of singular values to perturb.
        image_size (tuple): (height, width) of each input image.
    """

    def __init__(
        self,
        epsilon: float = 0.1,
        n_singular_values: int = 6,
        image_size: Tuple[int, int] = (100, 100),  # (height, width)
        block_size: Optional[int] = None,
    ) -> None:
        if epsilon <= 0:
            raise ValueError("epsilon must be > 0")
        if n_singular_values <= 0:
            raise ValueError("n_singular_values must be > 0")

        self.epsilon = float(epsilon)
        self.n_singular_values = int(n_singular_values)
        self.image_size = image_size
        self.block_size = block_size

    # ------------------------------------------------------------------
    # CORE DP-SVD MECHANISM
    # ------------------------------------------------------------------

    def _apply_dp_svd(self, matrix: np.ndarray, k_vals: int, eps: float) -> np.ndarray:
        """Apply DP-SVD logic to a 2D matrix."""
        U, S, Vt = np.linalg.svd(matrix, full_matrices=False)

        # keep top-k singular values
        k = min(k_vals, len(S))
        U_k = U[:, :k]
        Vt_k = Vt[:k, :]
        S_k = S[:k]

        # add Laplace noise to singular values
        # Sensitivity of singular values is 1 for [0, 1] range changes
        scale = 1.0 / eps
        noise = np.random.laplace(0, scale, k)
        S_noisy = np.clip(S_k + noise, 0, None)

        # reconstruct obfuscated matrix
        return (U_k * S_noisy) @ Vt_k

    def _apply_dp_svd_coeffs(
        self, matrix: np.ndarray, k_vals: int, eps: float
    ) -> np.ndarray:
        """
        Apply DP-SVD logic and return low-rank coefficient matrix (U_k * S_noisy).
        Shape: (height, k)
        """
        U, S, _Vt = np.linalg.svd(matrix, full_matrices=False)

        # keep top-k singular values
        k = min(k_vals, len(S))
        U_k = U[:, :k]
        S_k = S[:k]

        # add Laplace noise to singular values
        scale = 1.0 / eps
        noise = np.random.laplace(0, scale, k)
        S_noisy = np.clip(S_k + noise, 0, None)

        # return coefficient matrix for embedding
        return U_k * S_noisy

    def _dp_svd_one(self, img: np.ndarray, denoise: bool = False) -> np.ndarray:
        """Apply DP-SVD to a single grayscale image in [0, 1]."""
        if self.block_size is None:
            recon = self._apply_dp_svd(img, self.n_singular_values, self.epsilon)
        else:
            # Block-based DP-SVD (better preserves local features)
            h, w = img.shape
            bs = self.block_size
            recon = np.zeros_like(img)
            
            for i in range(0, h, bs):
                for j in range(0, w, bs):
                    block = img[i:i+bs, j:j+bs]
                    bh, bw = block.shape
                    
                    # Handle blocks at the edges
                    if bh < bs or bw < bs:
                        padded = np.pad(block, ((0, bs-bh), (0, bs-bw)), mode='edge')
                        dp_padded = self._apply_dp_svd(padded, self.n_singular_values, self.epsilon)
                        recon[i:i+bh, j:j+bw] = dp_padded[:bh, :bw]
                    else:
                        recon[i:i+bs, j:j+bs] = self._apply_dp_svd(block, self.n_singular_values, self.epsilon)

        # Robust normalization to [0, 1]
        recon = np.clip(recon, 0, 1)

        if denoise:
            # Simple denoising using a Median Filter to smooth out Laplace noise artifacts
            pil_img = Image.fromarray((recon * 255).astype(np.uint8), mode='L')
            pil_img = pil_img.filter(ImageFilter.MedianFilter(size=3))
            recon = np.array(pil_img).astype(np.float32) / 255.0

        return recon

    def _dp_svd_one_coeffs(self, img: np.ndarray) -> np.ndarray:
        """
        Return low-rank coefficient vector for a single image.
        If block_size is set, returns concatenated per-block coefficients
        in row-major order (top-left to bottom-right), with edge padding.
        """
        if self.block_size is None:
            coeffs = self._apply_dp_svd_coeffs(
                img, self.n_singular_values, self.epsilon
            )
            return coeffs.flatten()

        h, w = img.shape
        bs = self.block_size
        block_vectors = []

        for i in range(0, h, bs):
            for j in range(0, w, bs):
                block = img[i:i+bs, j:j+bs]
                bh, bw = block.shape

                if bh < bs or bw < bs:
                    block = np.pad(
                        block, ((0, bs-bh), (0, bs-bw)), mode='edge'
                    )

                coeffs = self._apply_dp_svd_coeffs(
                    block, self.n_singular_values, self.epsilon
                )
                block_vectors.append(coeffs.flatten())

        if not block_vectors:
            return np.array([], dtype=np.float32)

        return np.concatenate(block_vectors)

    # ------------------------------------------------------------------
    # PUBLIC API
    # ------------------------------------------------------------------

    def anonymize_images(
        self, flattened_images: np.ndarray, denoise: bool = False
    ) -> np.ndarray:
        """
        Apply DP-SVD anonymization to a stack of flattened grayscale images.

        Args:
            flattened_images (np.ndarray): Shape (num_images, n_pixels)
            denoise (bool): Whether to apply a denoising filter after reconstruction.

        Returns:
            np.ndarray: Anonymized (flattened) images.
        """
        n_images, n_pixels = flattened_images.shape
        height, width = self.image_size  # (height, width)

        anonymized = np.zeros_like(flattened_images, dtype=np.float32)
        for idx in range(n_images):
            img = flattened_images[idx].reshape(height, width)
            dp_img = self._dp_svd_one(img, denoise=denoise)
            anonymized[idx] = dp_img.flatten()
        return anonymized

    def embeddings_from_images(self, flattened_images: np.ndarray) -> np.ndarray:
        """
        Generate DP-SVD embeddings (low-rank coefficients) for flattened images.

        Returns:
            np.ndarray: Embedding matrix of shape (num_images, embedding_dim).
                - If block_size is None: embedding_dim = height * k
                - If block_size is set: embedding_dim = n_blocks * block_size * k
                  where n_blocks = ceil(height/bs) * ceil(width/bs)
        """
        n_images, _n_pixels = flattened_images.shape
        height, width = self.image_size  # (height, width)
        if self.block_size is None:
            embedding_dim = height * self.n_singular_values
        else:
            bs = self.block_size
            blocks_h = math.ceil(height / bs)
            blocks_w = math.ceil(width / bs)
            embedding_dim = blocks_h * blocks_w * bs * self.n_singular_values

        embeddings = np.zeros((n_images, embedding_dim), dtype=np.float32)
        for idx in range(n_images):
            img = flattened_images[idx].reshape(height, width)
            coeffs = self._dp_svd_one_coeffs(img)
            embeddings[idx] = coeffs

        return embeddings

    # ------------------------------------------------------------------
    # RECONSTRUCTION AND VISUALIZATION HELPERS
    # ------------------------------------------------------------------

    def reconstruct_and_save(
        self,
        anonymized_images: np.ndarray,
        output_folder: str,
        subject: str,
        show_plot: bool = False,
    ) -> None:
        """
        Save reconstructed anonymized images to disk (for inspection).
        """
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)

        height, width = self.image_size  # (height, width)
        n_images = anonymized_images.shape[0]

        for i in range(n_images):
            img_arr = anonymized_images[i].reshape(height, width)
            pil_img = numpy_image_to_pillow(img_arr)
            filename = f"{subject}_{i+1}.png"
            pil_img.save(os.path.join(output_folder, filename))
        print(f"Saved {n_images} DP-SVD images for subject {subject} -> {output_folder}")

        if show_plot:
            plt.figure(figsize=(10, 4))
            for i in range(min(n_images, 5)):
                plt.subplot(1, 5, i + 1)
                plt.imshow(anonymized_images[i].reshape(height, width), cmap="gray")
                plt.axis("off")
            plt.show()

    def reconstruct_to_base64(
        self,
        anonymized_images: np.ndarray,
        target_image_size: Tuple[int, int],
    ) -> List[Optional[str]]:
        """
        Convert anonymized image arrays to Base64-encoded PNGs.
        """
        height, width = target_image_size  # (height, width)
        results = []
        for recon_flat in anonymized_images:
            try:
                pil_img = numpy_image_to_pillow(recon_flat.reshape(height, width))
                b64_img = pillow_image_to_bytes(pil_img)
                results.append(b64_img)
            except Exception as e:
                print(f"Conversion error: {e}")
                results.append(None)
        return results