import numpy as np
import os
import random
from typing import List, Optional, Tuple
from PIL import Image
import matplotlib.pyplot as plt
from mok.preprocessing.utils_image import (
    pillow_image_to_bytes,
    numpy_image_to_pillow,
)


class KSamePixelAnonymizer:
    """
    K-Same-Pixel anonymization technique.
    
    For each image, creates a group of k images (the image itself plus k-1 randomly 
    selected others) and replaces the original with the mean face of the group.
    This provides k-anonymity at the pixel level.
    
    Args:
        k (int): The anonymity parameter - group size for k-anonymity.
        image_size (tuple): (width, height) of each input image.
    """
    
    def __init__(self, k: int = 3, image_size: Tuple[int, int] = (100, 100)) -> None:
        if k <= 0:
            raise ValueError("k must be > 0")
        self.k = int(k)
        self.image_size = image_size
    
    # ------------------------------------------------------------------
    # CORE K-SAME-PIXEL MECHANISM
    # ------------------------------------------------------------------
    
    def anonymize_images(self, flattened_images: np.ndarray) -> np.ndarray:
        """
        Apply k-same-pixel anonymization to a stack of flattened grayscale images.
        
        Args:
            flattened_images (np.ndarray): Shape (num_images, n_pixels)
        
        Returns:
            np.ndarray: Anonymized (flattened) images.
        """
        anonymized = []
        n_images = len(flattened_images)
        
        for i in range(n_images):
            base_img = flattened_images[i]
            indices = list(range(n_images))
            indices.remove(i)
            
            # Select k-1 other images to group with the current image
            if len(indices) >= self.k - 1:
                chosen_idx = random.sample(indices, self.k - 1)
            else:
                # If fewer than k-1 other images, repeat indices to reach k-1
                chosen_idx = (indices * ((self.k - 1) // len(indices) + 1))[: self.k - 1]
            
            # Create group and compute mean
            group = [base_img] + [flattened_images[j] for j in chosen_idx]
            mean_face = np.mean(group, axis=0).astype(np.float32)
            anonymized.append(mean_face)
        
        return np.array(anonymized, dtype=np.float32)
    
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
        
        width, height = self.image_size
        n_images = anonymized_images.shape[0]
        
        for i in range(n_images):
            img_arr = anonymized_images[i].reshape(height, width)
            pil_img = numpy_image_to_pillow(img_arr)
            filename = f"{subject}_{i+1}.png"
            pil_img.save(os.path.join(output_folder, filename))
        print(f"Saved {n_images} K-Same-Pixel images for subject {subject} -> {output_folder}")
        
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
        width, height = target_image_size
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
