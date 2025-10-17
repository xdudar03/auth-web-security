# -*- coding: utf-8 -*-
import binascii
import os
import io
import base64
import logging
from typing import List, Optional, Dict, Any, Tuple

import numpy as np
import pandas as pd
from PIL import Image, UnidentifiedImageError
from tqdm import tqdm
from werkzeug.datastructures import FileStorage

# Ensure import paths are correct for your project structure
try:
    from src.modules.image_preprocessing import preprocess_image
    from src.modules.eigenface import EigenfaceGenerator
    from src.modules.noise_generator import NoiseGenerator
    from src.modules.utils_image import numpy_image_to_pillow, pillow_image_to_bytes
    from src.config import IMAGE_SIZE as DEFAULT_IMAGE_SIZE
except ImportError:
    # Fallback if executed directly or different structure
    from src.modules.image_preprocessing import preprocess_image
    from src.modules.eigenface import EigenfaceGenerator
    from src.modules.noise_generator import NoiseGenerator
    from src.modules.utils_image import pillow_image_to_bytes, numpy_image_to_pillow
    DEFAULT_IMAGE_SIZE = (100, 100)
    print("Warning: Using fallback imports and default IMAGE_SIZE.")



# Directory to save final reconstructed images (single folder)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# TODO: If hard coded - May cause some problems depending on where the console is executed.
RECONSTRUCTED_DIR = ''
def set_reconstructed_dir(reconstructed_dir="../../data/reconstructed_pipeline"):
    global RECONSTRUCTED_DIR
    RECONSTRUCTED_DIR = reconstructed_dir
    os.makedirs(RECONSTRUCTED_DIR, exist_ok=True)


# --- Save Functions ---

def save_final_reconstructed_images(subject_id: str, images: List[Optional[str]], original_image_ids: List[Optional[str]]):
    """
    Saves the final reconstructed images (base64) for a subject
    directly into RECONSTRUCTED_DIR. The filename follows the format
    reconstructed_<subject_id>_<image_num>.png.
    """
    if not images or all(img is None for img in images):
        logger.warning(f"No final image to save for subject {subject_id}.")
        return

    saved_count = 0
    # Sanitize subject ID once
    safe_subject_id = "".join(c if c.isalnum() or c in ('_','-') else '_' for c in str(subject_id))

    for i, b64img in enumerate(images):
        if b64img is None: continue
        try:
            img_bytes = base64.b64decode(b64img)
            img = Image.open(io.BytesIO(img_bytes))

            # New filename: reconstructed_<subject_id>_<image_num>.png
            # Uses index 'i' as image_num for this subject
            filename = f"reconstructed_{int(safe_subject_id)+1}_{int(i)+1}.png"
            full_path = os.path.join(RECONSTRUCTED_DIR, filename)

            img.save(full_path)
            saved_count +=1
        except binascii.Error as b64_err:
             # Retrieve original ID just for the error log if possible
             original_id_for_log = original_image_ids[i] if i < len(original_image_ids) else f"index {i}"
             logger.error(f"Base64 decoding error for image {i} (orig ID: {original_id_for_log}) subject {subject_id}: {b64_err}. Image not saved.")
        except Exception as e:
            original_id_for_log = original_image_ids[i] if i < len(original_image_ids) else f"index {i}"
            logger.error(f"Error saving final image {i} (orig ID: {original_id_for_log}) subject {subject_id} to {full_path}: {e}. Image not saved.")

    if saved_count > 0:
        logger.info(f"{saved_count} final reconstructed images for subject {subject_id} saved in {RECONSTRUCTED_DIR}")


# --- Step 1: Preprocessing ---

# ---------------------------------------
# Step 1: Preprocessing
# ---------------------------------------
def run_preprocessing(
    folder_path: Optional[str] = None,
    df_images: Optional[pd.DataFrame] = None,
    b64_image_list: Optional[List[str]] = None,
    filestorage_list: Optional[List[FileStorage]] = None,
    image_size_override: Optional[Tuple[int, int]] = None
) -> Tuple[Dict[str, List[Dict[str, Any]]], Tuple[int, int]]:
    """
    Load and preprocess images from ONE source. Stores the original imageId.
    Allows specifying the image size.
    """
    num_sources = sum(p is not None for p in [folder_path, df_images, b64_image_list, filestorage_list])
    if num_sources != 1: raise ValueError("Provide exactly one image source.")

    target_image_size = image_size_override if image_size_override is not None else DEFAULT_IMAGE_SIZE
    logger.info(f"Running standard preprocessing with IMAGE_SIZE={target_image_size}...")

    image_groups: Dict[str, List[Dict[str, Any]]] = {} 
    processed_count = 0
    # --- Case 1: DataFrame ---
    if df_images is not None:
        logger.info(f"Processing {len(df_images)} images from DataFrame.")
        for index, row in tqdm(df_images.iterrows(), total=df_images.shape[0], desc="Preprocessing (DataFrame)"):
            try:
                img = row['userFaces']; subject_id = str(row['subject_number']); image_id = row.get('imageId', f"df_img_{index}")
                if not isinstance(img, Image.Image):
                     logger.warning(f"Index {index} (ID: {image_id}) is not a valid PIL image. Skip.")
                     continue
                preprocessed = preprocess_image(img, resize_size=target_image_size, create_flattened=True)
                if preprocessed and 'grayscale_image' in preprocessed:
                    preprocessed['imageId'] = image_id
                    image_groups.setdefault(subject_id, []).append(preprocessed)
                    processed_count += 1
                else: logger.warning(f"Preprocessing failed or missing 'grayscale_image' for index {index} (ID: {image_id}). Skip.")
            except Exception as e: logger.error(f"Error on image index {index} (ID: {image_id}): {e}", exc_info=True)
    # --- Case 2: Folder ---
    elif folder_path is not None:
        logger.info(f"Processing images from folder: {folder_path}")
        try:
            image_files = [f for f in os.listdir(folder_path) if
                           f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.pgm'))]
        except Exception as e:
            logger.error(f"Folder access error {folder_path}: {e}")
            raise
        logger.info(f"Found {len(image_files)} potential image files.")
        for filename in tqdm(image_files, desc="Preprocessing (Folder)"):
             try:
                parts = filename.split("_")
                subject_id = "unknown"
                if len(parts) >= 2: subject_id = parts[1]
                else: logger.warning(f"Filename '{filename}' does not follow the 'prefix_subjectId_...' convention. Assigned subject 'unknown'.")
                image_id = os.path.splitext(filename)[0]
                img_path = os.path.join(folder_path, filename)
                with Image.open(img_path) as img:
                    preprocessed = preprocess_image(img.convert('RGB'), resize_size=target_image_size, create_flattened=True)
                if preprocessed and 'grayscale_image' in preprocessed:
                    preprocessed['imageId'] = image_id
                    image_groups.setdefault(subject_id, []).append(preprocessed)
                    processed_count += 1
                else: logger.warning(f"Preprocessing failed or missing 'grayscale_image' for '{filename}'. Skip.")
             except UnidentifiedImageError: logger.error(f"Open/identify error '{filename}'. Skip."); continue
             except Exception as e: logger.error(f"Error processing file '{filename}': {e}", exc_info=True)
    # --- Case 3: Base64 List ---
    elif b64_image_list is not None:
        logger.info(f"Processing {len(b64_image_list)} images from Base64 list.")
        subject_id = "b64_subject_1"
        image_groups[subject_id] = []
        for i, b64_string in enumerate(tqdm(b64_image_list, desc="Preprocessing (Base64 List)")):
            try:
                image_id = f"b64_img_{i}"
                img_bytes = base64.b64decode(b64_string); img = Image.open(io.BytesIO(img_bytes))
                preprocessed = preprocess_image(img.convert('RGB'), resize_size=target_image_size, create_flattened=True)
                if preprocessed and 'grayscale_image' in preprocessed:
                    preprocessed['imageId'] = image_id
                    image_groups[subject_id].append(preprocessed)
                    processed_count += 1
                else: logger.warning(f"Preprocessing failed or missing 'grayscale_image' for base64 image index {i}. Skip.")
            except (binascii.Error, IOError, UnidentifiedImageError) as decode_err: logger.error(f"Decoding/opening error for base64 image index {i}: {decode_err}. Skip."); continue
            except Exception as e: logger.error(f"Error processing base64 image index {i}: {e}", exc_info=True)
    # --- Case 4: FileStorage List ---
    elif filestorage_list is not None:
        logger.info(f"Processing {len(filestorage_list)} FileStorage files.")
        subject_id = "upload_subject_1"
        image_groups[subject_id] = []
        for i, file_storage in enumerate(tqdm(filestorage_list, desc="Preprocessing (FileStorage List)")):
            try:
                image_id = f"upload_img_{i}"
                img = Image.open(file_storage.stream)
                preprocessed = preprocess_image(img.convert('RGB'), resize_size=target_image_size, create_flattened=True)
                if preprocessed and 'grayscale_image' in preprocessed:
                    preprocessed['imageId'] = image_id
                    image_groups[subject_id].append(preprocessed)
                    processed_count += 1
                else:
                    logger.warning(f"Preprocessing failed or missing 'grayscale_image' for FileStorage index {i}. Skip.")
            except UnidentifiedImageError:
                logger.error(f"Open/identify error for FileStorage index {i}. Skip.")
                continue
            except Exception as e:
                logger.error(f"Error processing FileStorage index {i}: {e}", exc_info=True)
    logger.info(f"Preprocessing finished. {processed_count} images processed for {len(image_groups)} subjects.")
    if processed_count == 0:
        logger.error("No images could be preprocessed. Check the source and logs.")
    return dict(image_groups), target_image_size


# --- Step 2: Eigenfaces computation (PEEP) ---

def run_eigenface(flattened_stack: np.ndarray, n_components: int):
    """Computes eigenfaces (PCA) on the provided stack."""
    logger.debug(f"Computing Eigenfaces with n_components={n_components} on stack of shape {flattened_stack.shape}")
    effective_n_components = min(n_components, flattened_stack.shape[0], flattened_stack.shape[1])
    if effective_n_components < n_components:
         logger.warning(f"Reducing n_components from {n_components} to {effective_n_components} due to stack dimensions ({flattened_stack.shape[0]} samples, {flattened_stack.shape[1]} features).")
    if effective_n_components < 1:
         logger.error(f"Cannot compute PCA with n_components={effective_n_components}. Stack shape: {flattened_stack.shape}")
         return None, None, None

    eigen_gen = EigenfaceGenerator(flattened_stack, n_components=effective_n_components)
    try:
        eigen_gen.generate()
        mean_face = eigen_gen.get_mean_face()
        pca = eigen_gen.get_pca_object()
        projection = pca.transform(flattened_stack) # Projection is the eigenfaces of the flattened stack
        logger.debug(f"PCA computed. Projection shape: {projection.shape}. Mean face shape: {mean_face.shape}")
        return pca, mean_face, projection
    except ValueError as pca_err:
        logger.error(f"PCA error: {pca_err}. Stack shape: {flattened_stack.shape}, n_components: {effective_n_components}")
        return None, None, None


# --- Step 4: Add differential noise (PEEP) ---

def run_add_noise(projection: np.ndarray, epsilon: float, sensitivity: float = 1.0):
    """Adds Laplacian noise to the projection."""
    if projection is None or projection.size == 0:
         logger.error("Invalid projection (None or empty) received for adding noise. Skip.")
         return None
    if epsilon <= 0:
        logger.info("Epsilon <= 0, no Laplacian noise will be added.")
        return projection

    logger.debug(f"Adding Laplacian noise (epsilon={epsilon}, sensitivity={sensitivity}) to projection shape {projection.shape}")
    try:
        noise_gen = NoiseGenerator(projection, epsilon)
        noise_gen.normalize_images()
        noise_gen.add_laplace_noise(sensitivity)
        noised_projection = noise_gen.get_noised_eigenfaces()
        logger.debug(f"Noise added. Noised projection shape: {noised_projection.shape}")
        return noised_projection
    except Exception as noise_err:
        logger.error(f"Error while adding Laplacian noise: {noise_err}", exc_info=True)
        return None


# --- Step 5: Reconstruction (PEEP) ---

def run_reconstruction(
    pca: Optional[Any],
    noised_projection: Optional[np.ndarray],
    target_image_size: Tuple[int, int]
) -> List[Optional[str]]:
    """
    Reconstructs images from the noised projection.
    """
    if pca is None:
         logger.error("Missing PCA object for reconstruction.")
         return []
    if noised_projection is None:
         logger.error("Missing noised projection for reconstruction.")
         return []
    if noised_projection.size == 0:
        logger.warning("Empty projection provided for reconstruction. Returning empty list.")
        return []

    logger.debug(f"Reconstructing images from noised projection with shape {noised_projection.shape}...")
    reconstructed_images_b64 = []
    try:
        reconstructions_flat = pca.inverse_transform(noised_projection)
        logger.debug(f"Inverse transform completed. Flattened reconstructions shape: {reconstructions_flat.shape}")

        expected_shape_hw = (target_image_size[1], target_image_size[0])

        for recon_flat in reconstructions_flat:
            try:
                if recon_flat.size != expected_shape_hw[0] * expected_shape_hw[1]:
                    logger.error(f"Flattened reconstructed image size ({recon_flat.size}) "
                                 f"does not match expected size {expected_shape_hw[0] * expected_shape_hw[1]}. Skipping this image.")
                    reconstructed_images_b64.append(None)
                    continue

                pil_img = numpy_image_to_pillow(recon_flat, resized_size=expected_shape_hw)
                b64_img = pillow_image_to_bytes(pil_img)
                reconstructed_images_b64.append(b64_img)
            except ValueError as reshape_err:
                 logger.error(f"Error during reshape/PIL conversion for a reconstructed image: {reshape_err}. Recon flat size: {recon_flat.size}, target shape HW: {expected_shape_hw}", exc_info=True)
                 reconstructed_images_b64.append(None)
            except Exception as e:
                logger.error(f"Error converting/encoding Base64 for a reconstructed image: {e}", exc_info=True)
                reconstructed_images_b64.append(None)

    except Exception as inv_tf_err:
        logger.error(f"Error during pca.inverse_transform: {inv_tf_err}", exc_info=True)
        num_images_expected = noised_projection.shape[0]
        return [None] * num_images_expected

    logger.debug(f"{len(reconstructed_images_b64)} images prepared for return (some may be None).")
    return reconstructed_images_b64


# --- Global function to run the SEQUENTIAL pipeline ---

def run_pipeline(
    folder_path: Optional[str] = None,
    df_images: Optional[pd.DataFrame] = None,
    b64_image_list: Optional[List[str]] = None,
    image_size_override: Optional[Tuple[int, int]] = None,
    n_components_ratio: float = 0.8,
    epsilon: float = 1.0
) -> Dict[str, Dict[str, Any]]:
    """
    Executes the sequential pipeline: Preprocessing -> PCA -> Noise -> Reconstruction/Save.
    """
    pipeline_results = {}
    logger.info(f"Starting SEQUENTIAL pipeline: ratio={n_components_ratio}, eps={epsilon}")

    # --- Step 1: Preprocessing ---
    try:
        image_groups, used_image_size = run_preprocessing(
            folder_path=folder_path, df_images=df_images, b64_image_list=b64_image_list,
            image_size_override=image_size_override
        )
    except ValueError as e:
        logger.error(f"Preprocessing configuration error: {e}")
        return {}
    except Exception as e:
         logger.error(f"Unexpected error during preprocessing: {e}", exc_info=True)
         return {}

    if not image_groups:
        logger.error("Preprocessing returned no valid images. Stopping.")
        return {}
    logger.info(f"Preprocessing finished. Image size used: {used_image_size}")

    # --- Step 2: Eigenfaces computation (PEEP) ---
    logger.info("Starting PCA projection, noise addition, and reconstruction...")

    for subject_id in tqdm(image_groups.keys(), desc="PEEP processing per subject"):
        pipeline_results[subject_id] = {
            "imageIds": [img_dict.get('imageId', f'unknown_{i}') for i, img_dict in enumerate(image_groups[subject_id])],
            "final_reconstructed_b64": [None] * len(image_groups[subject_id]),
            "errors": []
        }
        subject_errors = []

        subject_preprocessed = image_groups.get(subject_id, [])

        if len(subject_preprocessed) < 2:
            msg = f"Subject {subject_id}: fewer than 2 preprocessed images available ({len(subject_preprocessed)}). Skipping."
            logger.warning(msg)
            pipeline_results[subject_id]['errors'].append(msg)
            continue

        flattened_stack_list = []
        valid_indices_map = {}

        for idx, img_dict in enumerate(subject_preprocessed):
            flattened = img_dict.get('flattened_image')
            if flattened is not None and isinstance(flattened, np.ndarray) and flattened.ndim == 1:
                flattened_stack_list.append(flattened)
                valid_indices_map[idx] = len(flattened_stack_list) - 1
            else:
                msg = f"Subject {subject_id}, index {idx}: missing or invalid flattened_image."
                logger.warning(msg)
                subject_errors.append(msg + f" Image ID: {img_dict.get('imageId', 'N/A')}")

        if len(flattened_stack_list) < 2:
            msg = f"Subject {subject_id}: fewer than 2 valid flattened images ({len(flattened_stack_list)}). Skipping."
            logger.warning(msg)
            pipeline_results[subject_id]['errors'].append(msg)
            pipeline_results[subject_id]['errors'].extend(subject_errors)
            continue

        flattened_stack_np = np.array(flattened_stack_list, dtype=np.float32)
        n_samples, n_features = flattened_stack_np.shape

        n_components = min(max(1, int(n_components_ratio * n_samples)), n_features)
        logger.debug(f"Subject {subject_id}: PCA with n_components={n_components} on stack shape {flattened_stack_np.shape}")

        # Exécuter les étapes PEEP
        pca, _, projection = run_eigenface(flattened_stack_np, n_components)

        if pca is None or projection is None:
             msg = f"Subject {subject_id}: Failed PCA/projection computation. PEEP stopped for this subject."
             logger.error(msg)
             pipeline_results[subject_id]['errors'].append(msg)
             pipeline_results[subject_id]['errors'].extend(subject_errors)
             continue

        noised_projection = run_add_noise(projection, epsilon)
        if noised_projection is None:
             msg = f"Subject {subject_id}: Failed to add noise. PEEP stopped for this subject."
             logger.error(msg)
             pipeline_results[subject_id]['errors'].append(msg)
             pipeline_results[subject_id]['errors'].extend(subject_errors)
             continue

        reconstructed_b64_list_valid = run_reconstruction(pca, noised_projection, used_image_size)

        # Re-insert reconstructed images at the correct indices
        if len(reconstructed_b64_list_valid) == len(valid_indices_map):
             for original_idx, stack_idx in valid_indices_map.items():
                  if stack_idx < len(reconstructed_b64_list_valid):
                     pipeline_results[subject_id]["final_reconstructed_b64"][original_idx] = reconstructed_b64_list_valid[stack_idx]
                  else:
                     msg = f"Subject {subject_id}: Stack index ({stack_idx}) out of bounds for reconstructed results ({len(reconstructed_b64_list_valid)}). Internal logic error."
                     logger.error(msg)
                     subject_errors.append(msg)
        else:
             msg = (f"Subject {subject_id}: Size mismatch between reconstructed images "
                    f"({len(reconstructed_b64_list_valid)}) and valid inputs processed ({len(valid_indices_map)}). "
                    f"Partial or no reconstruction for this subject.")
             logger.error(msg)
             subject_errors.append(msg)
             for original_idx, stack_idx in valid_indices_map.items():
                  if stack_idx < len(reconstructed_b64_list_valid):
                      pipeline_results[subject_id]["final_reconstructed_b64"][original_idx] = reconstructed_b64_list_valid[stack_idx]

        # --- Final Save ---
        save_final_reconstructed_images(
            subject_id,
            pipeline_results[subject_id]["final_reconstructed_b64"],
            pipeline_results[subject_id]["imageIds"]
        )

        pipeline_results[subject_id]['errors'].extend(subject_errors)

    logger.info("SEQUENTIAL pipeline finished.")
    # Clean results
    final_results = {sid: data for sid, data in pipeline_results.items() if any(img is not None for img in data["final_reconstructed_b64"])}
    if len(final_results) < len(pipeline_results):
        logger.warning(f"{len(pipeline_results) - len(final_results)} subjects produced no valid final images and were excluded from the return.")

    return final_results