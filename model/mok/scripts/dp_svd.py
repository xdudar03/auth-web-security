from mok.privacy.dp_svd import DPSVDAnonymizer
import numpy as np
from mok.preprocessing.image_preprocessing import preprocess_images_yalefaces
from typing import Tuple
import os

def run_dp_svd(input_dir: str, output_dir: str, epsilon: float, n_singular_values: int, block_size: int, image_size: Tuple[int, int]):

    print("Preprocessing images for anonymization...")
    image_groups, (processed_count, total_images_count) = preprocess_images_yalefaces(folder_path=input_dir, image_size=image_size)
    print(f"Out of {total_images_count} images, {processed_count} were successfully preprocessed")

    os.makedirs(output_dir, exist_ok=True)

    for subject_id, images in image_groups.items():
        flattened_images = [image_dict['flattened_image'] for image_dict in images]
        flattened_images_array = np.array(flattened_images, dtype=np.float32)

        # assume flattened_images: (num_images, 10000)
        anonymizer = DPSVDAnonymizer(epsilon=epsilon, n_singular_values=n_singular_values, image_size=image_size, block_size=block_size)

        dp_svd_images = anonymizer.anonymize_images(flattened_images_array)

        # Save to disk (one subject example)
        anonymizer.reconstruct_and_save(dp_svd_images, output_dir, subject=subject_id)


if __name__ == "__main__":
    run_dp_svd(input_dir="datasets/yalefaces", output_dir="datasets/dp_svd", epsilon=0.4, n_singular_values=15, block_size=25, image_size=(100, 100))  # (height, width)