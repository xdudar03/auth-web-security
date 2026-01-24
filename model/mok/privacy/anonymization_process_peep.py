import os
from PIL import Image
from typing import List, Any, Tuple, Optional
import numpy as np
from mok.models.eigenfaces import EigenfaceGenerator
from mok.privacy.noise_generator import NoiseGenerator
import matplotlib.pyplot as plt
import base64
import io
from mok.preprocessing.utils_image import pillow_image_to_bytes, numpy_image_to_pillow

def create_eigenfaces(flattened_images: np.ndarray, n_components: int):
    print(f"Creating eigenfaces with PCA for {len(flattened_images)} images with {n_components} components...")
    eigenfaces_generator = EigenfaceGenerator(flattened_images, n_components)
    try:
        eigenfaces_generator.generate()
        pca_object = eigenfaces_generator.get_pca_object() # PCA object is used to project the images onto the eigenface space
        eigenvectors = pca_object.components_ # eigenvectors are the principal components
        projection = pca_object.transform(flattened_images) # projection is the images in the eigenface space
        return eigenvectors, projection, pca_object
    except Exception as e:
        print(f"Error creating eigenfaces: {e}")
        return None, None, None
    
def add_noise(eigen_elements: np.ndarray, epsilon: float, sensitivity: float = 1.0):
    """
    Adds Laplacian noise to the eigen_elements to ensure differential privacy.
    """
    if epsilon <= 0:
        raise ValueError("Epsilon must be greater than 0")
    if sensitivity <= 0:
        raise ValueError("Sensitivity must be greater than 0")
    noise_generator = NoiseGenerator(eigen_elements, epsilon)
    try:
        noise_generator.normalize_images()
        noise_generator.add_laplace_noise(sensitivity)
        noised_eigen_elements = noise_generator.get_noised_eigenfaces()
        return noised_eigen_elements
    except Exception as e:
        print(f"Error adding noise: {e}")
        return None

def run_reconstruction(
    pca: Optional[Any],
    noised_projection: Optional[np.ndarray],
    target_image_size: Tuple[int, int],
    noised_eigenvectors: Optional[np.ndarray] = None,
) -> List[Optional[str]]:
    """
    Reconstructs images from the noised projection.
    If `noised_eigenvectors` is provided, it uses them instead of the PCA's original components.
    """
    if pca is None:
        print("Missing PCA object for reconstruction.")
        return []
    if noised_projection is None or noised_projection.size == 0:
        print("Missing or empty noised projection.")
        return []
    if noised_eigenvectors is None or noised_eigenvectors.size == 0:
        print("Missing or empty noised eigenvectors.")
        return []

    reconstructed_images_b64 = []
    try:

        print(
            f"Reconstructing using noised projections {noised_projection.shape} "
            f"and noised eigenvectors {noised_eigenvectors.shape}..."
        )
        if pca.mean_.ndim == 1:
            mean_face = pca.mean_[None, :]  # make it 2D
        else:
            mean_face = pca.mean_
        reconstructions_flat = mean_face + np.dot(noised_projection, noised_eigenvectors)

        print(f"Inverse transform (manual or PCA) completed. Shape: {reconstructions_flat.shape}")

        # --- convert reconstructed arrays to base64 images ---
        expected_shape_hw = (target_image_size[1], target_image_size[0])
        for recon_flat in reconstructions_flat:
            try:
                if recon_flat.size != expected_shape_hw[0] * expected_shape_hw[1]:
                    print(
                        f"Flattened reconstructed image size ({recon_flat.size}) "
                        f"does not match expected size {expected_shape_hw[0] * expected_shape_hw[1]}."
                    )
                    reconstructed_images_b64.append(None)
                    continue

                pil_img = numpy_image_to_pillow(recon_flat, resized_size=expected_shape_hw)
                b64_img = pillow_image_to_bytes(pil_img)
                reconstructed_images_b64.append(b64_img)
            except Exception as e:
                print(f"Reconstruction conversion failure: {e}", exc_info=True)
                reconstructed_images_b64.append(None)

    except Exception as recon_err:
        print(f"Error during reconstruction: {recon_err}", exc_info=True)
        num_images_expected = noised_projection.shape[0]
        return [None] * num_images_expected

    print(f"{len(reconstructed_images_b64)} reconstructed images prepared.")
    return reconstructed_images_b64  

def save_images(images: List[Optional[str]], subject_id: str, output_folder: str):
    """
    Saves the images to the output folder.
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    saved_count = 0
    for image_index, image in enumerate(images):
        if image is not None:
            img_bytes = base64.b64decode(image)
            img = Image.open(io.BytesIO(img_bytes))
            filename = f"{subject_id}_{image_index+1}.png"
            full_path = os.path.join(output_folder, filename)
            img.save(full_path)
            saved_count += 1
    print(f"Images saved to {output_folder}")
    print(f"{saved_count} images saved")