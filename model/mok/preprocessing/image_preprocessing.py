import numpy as np
from PIL import Image
from typing import Dict, List, Any, Tuple
import os


def flatten_image(img: Image.Image) -> np.ndarray:
    """
    Flattens an image (PIL or NumPy array) into a 1D vector.

    Args:
        img (PIL.Image.Image or np.ndarray): Image to flatten.

    Returns:
        np.ndarray: Flattened image.
    """
    if isinstance(img, Image.Image):
        img = np.array(img)
    return img.flatten()


def preprocess_image(img: Image.Image, resize_size: tuple, create_grayscale: bool = True,
                     create_normalized: bool = True, create_flattened: bool = True) -> dict:
    """
    Preprocesses an image by resizing it and applying various conversions.

    Args:
        img (PIL.Image.Image): Source image.
        resize_size (tuple): Target size (width, height).
        create_grayscale (bool, optional): Convert to grayscale. Default: True.
        create_normalized (bool, optional): Normalize pixels to the [0, 1] range. Default: True.
        create_flattened (bool, optional): Flatten the image. Default: True.

    Returns:
        dict: Dictionary containing the preprocessed versions of the image.
    """
    try:
        processed_data = {}
        resized_img = img.resize(resize_size)
        if resized_img.size != resize_size:
            print(f"ERROR: Incorrect resize: {resized_img.size} instead of {resize_size}")
            return {}
        processed_data['resized_image'] = resized_img

        # Grayscale conversion
        if create_grayscale:
            grayscale_img = resized_img.convert("L")
            processed_data['grayscale_image'] = grayscale_img
        else:
            grayscale_img = resized_img

        # Normalization
        if create_normalized:
            normalized_img = np.array(grayscale_img) / 255.0
            processed_data['normalized_image'] = normalized_img
        else:
            normalized_img = np.array(grayscale_img)

        # Flattening
        if create_flattened:
            flattened_image = normalized_img.flatten()
            processed_data['flattened_image'] = flattened_image

        return processed_data

    except Exception as e:
        print(f"Error during preprocessing: {e}")
        return {}

def preprocess_images_yalefaces(folder_path: str, image_size: Tuple[int, int]) -> Tuple[Dict[str, List[Dict[str, Any]]], Tuple[int, int]]:
    # get all the images in the folder
    images = os.listdir(folder_path)
    image_groups: Dict[str, List[Dict[str, Any]]] = {} 
    processed_count = 0
    # for each image, get the subject name
    for image in images:
        # print(f"Processing image: {image}")
        # get the subject id from the image name, the format is "subject00.emotion.png"
        subject_id = image.split(".")[0].split("subject")[1]
        # print(f"Subject id: {subject_id}")
        with Image.open(os.path.join(folder_path, image)) as img:
            preprocessed_image = preprocess_image(img.convert("RGB"), image_size, create_flattened=True)
        if preprocessed_image and 'grayscale_image' in preprocessed_image:
            preprocessed_image['imageId'] = subject_id
            # print("Preprocessed image: ", preprocessed_image)
            image_groups.setdefault(subject_id, []).append(preprocessed_image)
            processed_count += 1
    if processed_count != len(images):
        print(f"Processed {processed_count} images, but found {len(images)} images")
    return dict[str, List[Dict[str, Any]]](image_groups), (processed_count, len(images))
