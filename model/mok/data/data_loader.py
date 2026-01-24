# src/modules/data_loader.py

import os
import numpy as np
from PIL import Image
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import joblib # To save/load the LabelEncoder
from typing import Tuple, List, Optional, Dict, Any

# --- Utility Functions ---

def save_label_encoder(encoder: LabelEncoder, filepath: str):
    """Save a LabelEncoder object to a file."""
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True) # Create parent folder if needed
        joblib.dump(encoder, filepath)
        print(f"LabelEncoder saved to: {filepath}")
    except Exception as e:
        print(f"Error while saving LabelEncoder: {e}")

def load_label_encoder(filepath: str) -> Optional[LabelEncoder]:
    """Load a LabelEncoder object from a file."""
    try:
        if os.path.exists(filepath):
            encoder = joblib.load(filepath)
            print(f"LabelEncoder loaded from: {filepath}")
            return encoder
        else:
            print(f"Error: LabelEncoder file not found at: {filepath}")
            return None
    except Exception as e:
        print(f"Error while loading LabelEncoder: {e}")
        return None

# --- Main Loading Function ---

def load_anonymized_images_flat(
        # .......................................................sql_lite
    data_dir: str,
    img_width: int,
    img_height: int,
    color_mode: str = 'grayscale' # 'grayscale' or 'rgb'
) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[LabelEncoder]]:
    """
    Load anonymized images from a flat folder.

    Filenames must follow the pattern: '<subject_id>_<num_img>.png'
    where <subject_id> is an integer.

    Args:
        data_dir: Path to the folder containing .png images.
        img_width: Target image width.
        img_height: Target image height.
        color_mode: 'grayscale' for grayscale (1 channel), 'rgb' for color (3 channels).

    Returns:
        Tuple containing:
        - X: np.ndarray of image data (None on error).
        - y: np.ndarray of encoded integer labels (None on error).
        - label_encoder: The fitted LabelEncoder object (None on error).
        Returns (None, None, None) if no image is loaded or on major error.
    """
    images = []
    labels_original = [] # Stores subject_id (strings) extracted from filenames
    required_parts = 2 # '<subject_id>', '<num_img>.png'

    print(f"Loading images from: {data_dir}")
    print(f"Expected format: {img_width}x{img_height}, mode: {color_mode}")

    if not os.path.isdir(data_dir):
        print(f"Error: The specified folder does not exist: {data_dir}")
        return None, None, None

    try:
        filenames = [f for f in os.listdir(data_dir) if f.lower().endswith('.png')]
        if not filenames:
            print(f"Error: No .png files found in {data_dir}")
            return None, None, None

        print(f"Found {len(filenames)} PNG files.")

        processed_files = 0
        skipped_files = 0
        for filename in filenames:
            try:
                parts = filename.split('_')
                # Check filename format
                if len(parts) < required_parts or not parts[0].isdigit():
                    print(f"Warning: Unexpected filename format, file skipped: {filename}")
                    skipped_files += 1
                    continue

                subject_id = parts[0] # The label is the subject_id

                # Load image
                img_path = os.path.join(data_dir, filename)
                with Image.open(img_path) as img:
                    # Color conversion
                    pil_mode = 'L' if color_mode == 'grayscale' else 'RGB'
                    img_converted = img.convert(pil_mode)

                    # Resize
                    img_resized = img_converted.resize((img_width, img_height))

                    # Convert to NumPy array
                    img_array = np.array(img_resized)

                    images.append(img_array)
                    labels_original.append(subject_id)
                    processed_files += 1

            except FileNotFoundError:
                print(f"Error: File not found (possibly removed during scanning?): {filename}")
                skipped_files += 1
            except Exception as e:
                print(f"Error processing file {filename}: {e}")
                skipped_files += 1

        print(f"Loading finished. {processed_files} images processed, {skipped_files} files skipped.")

        if not images:
            print("Error: No image could be loaded successfully.")
            return None, None, None

        # Convert to NumPy arrays
        X = np.array(images)
        y_original = np.array(labels_original)

        # Normalize pixel values [0, 1]
        X = X.astype('float32') / 255.0

        # Reshape for Keras/TensorFlow: (samples, height, width, channels)
        channels = 1 if color_mode == 'grayscale' else 3
        X = X.reshape(-1, img_height, img_width, channels)
        print(f"Final data shape (X): {X.shape}")

        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y_original)
        num_classes = len(label_encoder.classes_)
        print(f"{len(y_original)} original labels encoded into {num_classes} numeric classes.")
        # Show mapping (optional, can be long)
        # print("LabelEncoder mapping (numeric -> original):")
        # for i, class_name in enumerate(label_encoder.classes_):
        #    print(f"{i} -> {class_name}")

        return X, y, label_encoder

    except Exception as e:
        print(f"Major error while loading data: {e}")
        return None, None, None


# --- Data Splitting Functions ---

def split_data_stratified(
    X: np.ndarray,
    y: np.ndarray,
    test_size: float = 0.2,
    validation_size: float = 0.0, # Proportion of the training set to use for validation
    random_state: Optional[int] = None
) -> Dict[str, np.ndarray]:
    """
    Split the data into training, validation, and test sets using standard stratification.

    Args:
        X: Image data.
        y: Integer labels.
        test_size: Proportion for the test set (e.g., 0.2 for 20%).
        validation_size: Proportion of the initial training set to use as a validation set (e.g., 0.1 for 10%).
                         If 0.0, no separate validation set is returned.
        random_state: Seed for reproducibility.

    Returns:
        A dictionary containing the sets:
        {'X_train': ..., 'y_train': ..., 'X_val': ..., 'y_val': ..., 'X_test': ..., 'y_test': ...}
        Validation keys may be absent if validation_size is 0.
    """
    print(f"Data split: test_size={test_size}, validation_size={validation_size}")
    data_split: Dict[str, np.ndarray] = {}

    if test_size > 0:
        X_train_val, X_test, y_train_val, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state,
            stratify=y
        )
        data_split['X_test'] = X_test
        data_split['y_test'] = y_test
        print(f"Test Size: {len(X_test)} samples")
    else:
        X_train_val, y_train_val = X.copy(), y.copy() # No test set

    if validation_size > 0 and len(X_train_val) > 0 :
         # Compute validation size relative to the remaining set (train+val)
         val_split_ratio = validation_size / (1.0 - test_size) if (1.0 - test_size) > 0 else validation_size
         if val_split_ratio >= 1.0:
              print("Warning: validation_size too large relative to test_size, not enough data for training.")
              data_split['X_train'] = np.array([])
              data_split['y_train'] = np.array([])
              data_split['X_val'] = X_train_val
              data_split['y_val'] = y_train_val
         else:
            X_train, X_val, y_train, y_val = train_test_split(
                X_train_val, y_train_val,
                test_size=val_split_ratio, # Size relative to X_train_val
                random_state=random_state,
                stratify=y_train_val
            )
            data_split['X_train'] = X_train
            data_split['y_train'] = y_train
            data_split['X_val'] = X_val
            data_split['y_val'] = y_val
            print(f"Training Size: {len(X_train)} samples")
            print(f"Validation Size: {len(X_val)} samples")

    else: # No separate validation set
         data_split['X_train'] = X_train_val
         data_split['y_train'] = y_train_val
         print(f"Training Size: {len(X_train_val)} samples")
         # No X_val, y_val keys in the dictionary

    return data_split


def split_data_fixed_per_subject(
    X: np.ndarray,
    y: np.ndarray,
    n_train_per_class: int,
    random_state: Optional[int] = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Split the data ensuring there are exactly n_train_per_class samples per class in the training set.

    Args:
        X: Image data.
        y: Integer labels.
        n_train_per_class: Number of samples to put into training for each class.
        random_state: Seed for reproducible shuffling.

    Returns:
        Tuple: (X_train, X_test, y_train, y_test)
    """
    print(f"Custom split: {n_train_per_class} training samples per class.")
    if random_state is not None:
        np.random.seed(random_state)

    X_train_list, y_train_list = [], []
    X_test_list, y_test_list = [], []

    unique_labels, counts = np.unique(y, return_counts=True)
    min_count = counts.min()

    if n_train_per_class > min_count:
        print(f"Error: n_train_per_class ({n_train_per_class}) is greater than the minimum number "
              f"of samples for a class ({min_count}). Adjust n_train_per_class.")
        # Return empty arrays to indicate failure
        return np.array([]), np.array([]), np.array([]), np.array([])
    elif n_train_per_class == min_count:
        print(f"Warning: n_train_per_class ({n_train_per_class}) equals the minimum number "
              f"of samples. Some classes will have NO test samples.")


    for label_encoded in unique_labels:
        indices = np.where(y == label_encoded)[0]
        current_count = len(indices)

        if current_count < n_train_per_class:
             # Should not happen if the above check passed, but safety
             print(f"Internal error: Class {label_encoded} has fewer samples ({current_count}) than n_train_per_class ({n_train_per_class}).")
             continue

        # Shuffle indices for this class
        np.random.shuffle(indices)

        # Select for training and test
        train_indices = indices[:n_train_per_class]
        test_indices = indices[n_train_per_class:] # May be empty if current_count == n_train_per_class

        # Append to lists
        X_train_list.append(X[train_indices])
        y_train_list.append(y[train_indices])
        if len(test_indices) > 0:
            X_test_list.append(X[test_indices])
            y_test_list.append(y[test_indices])

    # Concatenate lists
    X_train = np.concatenate(X_train_list, axis=0)
    y_train = np.concatenate(y_train_list, axis=0)

    if not X_test_list: # If no class had any test samples
         X_test, y_test = np.array([]), np.array([])
         print("Warning: No test samples were generated.")
    else:
        X_test = np.concatenate(X_test_list, axis=0)
        y_test = np.concatenate(y_test_list, axis=0)


    # Shuffle final sets (important because concatenation groups by class)
    train_perm = np.random.permutation(len(X_train))
    X_train = X_train[train_perm]
    y_train = y_train[train_perm]

    if len(X_test) > 0:
        test_perm = np.random.permutation(len(X_test))
        X_test = X_test[test_perm]
        y_test = y_test[test_perm]

    print(f"Split completed. Training: {len(X_train)} samples, Test: {len(X_test)} samples.")
    return X_train, X_test, y_train, y_test
