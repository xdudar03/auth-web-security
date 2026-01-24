import mok.privacy.anonymization_process_peep as ap
import numpy as np
from typing import Tuple
import os
from mok.preprocessing.image_preprocessing import preprocess_images_yalefaces

def run_peep(
    input_dir: str,
    output_dir: str,
    epsilon_projection: float,
    epsilon_eigenvectors: float,
    image_size: Tuple[int, int] = (100, 100),
    n_components_ratio: float = 0.8,
) -> None:
    """Run the anonymization (PEEP) pipeline and save reconstructed images.

    This reuses functions from anonymization_process and overrides its module-level
    configuration for image size and output directory at runtime.
    """
    # Ensure output directory exists and configure anonymization module constants
    os.makedirs(output_dir, exist_ok=True)

    print("Preprocessing images for anonymization...")
    image_groups, (processed_count, total_images_count) = preprocess_images_yalefaces(folder_path=input_dir, image_size=image_size)
    print(f"Out of {total_images_count} images, {processed_count} were successfully preprocessed")

    for subject_id, images in image_groups.items():
        flattened_images = [image_dict['flattened_image'] for image_dict in images]
        flattened_images_array = np.array(flattened_images, dtype=np.float32)
        n_samples, n_features = flattened_images_array.shape

        n_components = min(max(1, int(n_components_ratio * n_samples)), n_features)

        eigenvectors, projection, pca_object = ap.create_eigenfaces(flattened_images_array, n_components)
        if eigenvectors is None or projection is None or pca_object is None:
            print(f"Error creating eigenfaces for subject {subject_id}; skipping.")
            continue

        noised_projection = ap.add_noise(projection, epsilon=epsilon_projection)
        noised_eigenvectors = ap.add_noise(eigenvectors, epsilon=epsilon_eigenvectors)
        if noised_projection is None or noised_eigenvectors is None:
            print(f"Error adding noise for subject {subject_id}; skipping.")
            continue

        reconstructed_images = ap.run_reconstruction(
            pca_object,
            noised_projection,
            image_size,
            noised_eigenvectors,
        )
        if not reconstructed_images:
            print(f"Error reconstructing images for subject {subject_id}; skipping.")
            continue

        ap.save_images(reconstructed_images, subject_id, output_folder=output_dir)

    print("Anonymization process completed.")

if __name__ == "__main__":
    run_peep(
        input_dir="datasets/yalefaces",
        output_dir="datasets/peep",
        epsilon_projection=1.0,
        epsilon_eigenvectors=10.0,
        image_size=(100, 100),
        n_components_ratio=0.8,
    )