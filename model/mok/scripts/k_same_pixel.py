from mok.privacy.k_same_pixel import KSamePixelAnonymizer
import numpy as np
from mok.preprocessing.image_preprocessing import preprocess_images_yalefaces
from typing import Tuple
import os


def run_k_same_pixel(input_dir: str, output_dir: str, k: int, image_size: Tuple[int, int] = (100, 100)):

    print("Preprocessing images for anonymization...")
    image_groups, (processed_count, total_images_count) = preprocess_images_yalefaces(folder_path=input_dir, image_size=image_size)
    print(f"Out of {total_images_count} images, {processed_count} were successfully preprocessed")

    os.makedirs(output_dir, exist_ok=True)

    for subject_id, images in image_groups.items():
        flattened_images = [image_dict['flattened_image'] for image_dict in images]
        flattened_images_array = np.array(flattened_images, dtype=np.float32)

        # Create K-Same-Pixel anonymizer with specified k parameter
        anonymizer = KSamePixelAnonymizer(k=k, image_size=image_size)

        # Apply k-same-pixel anonymization
        anonymized_images = anonymizer.anonymize_images(flattened_images_array)

        # Save to disk (one subject at a time)
        anonymizer.reconstruct_and_save(anonymized_images, output_dir, subject=subject_id)


if __name__ == "__main__":
    run_k_same_pixel(input_dir="datasets/yalefaces", output_dir="datasets/k_same_pixel_faces", k=10, image_size=(100, 100))