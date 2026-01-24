"""
Simple Re-identification Attack
================================

This script implements a basic linkage attack that attempts to re-identify
anonymized faces by computing pixel-wise similarity with original images.

The attack works by:
1. Loading original (non-anonymized) face images
2. Loading anonymized face images
3. Computing similarity scores between each anonymized and original image
4. Making re-identification guesses based on highest similarity
5. Reporting attack success rate
"""

import os
import argparse
import numpy as np
from pathlib import Path
from PIL import Image
from collections import defaultdict
from typing import Tuple, Dict, List


def load_images_from_directory(
    directory: str,
    img_width: int = 100,
    img_height: int = 100
) -> Tuple[Dict[str, List[np.ndarray]], List[str]]:
    """
    Load images organized by subject from a directory.
    
    Args:
        directory: Path to directory containing images
        img_width: Target image width
        img_height: Target image height
    
    Returns:
        Tuple of (subject_images_dict, all_filenames)
        subject_images_dict maps subject_id -> list of image arrays
    """
    subject_images = defaultdict(list)
    all_filenames = []
    
    directory = Path(directory)
    
    # Handle both flat and nested directory structures
    image_files = []
    if any(d.is_dir() for d in directory.iterdir() if not d.name.startswith('.')):
        # Nested structure: datasets/method/subject_id/image.png
        for subject_dir in sorted(directory.iterdir()):
            if subject_dir.is_dir() and not subject_dir.name.startswith('.'):
                subject_id = subject_dir.name
                for img_file in sorted(subject_dir.glob('*.png')):
                    image_files.append((subject_id, img_file))
    else:
        # Flat structure: datasets/method/subject_id_image.png
        for img_file in sorted(directory.glob('*.png')):
            # Extract subject_id from filename (assuming format: subjectX_Y.png or similar)
            filename = img_file.stem
            # Try to extract subject ID from various naming conventions
            if '_' in filename:
                subject_id = filename.split('_')[0]
            else:
                subject_id = filename
            image_files.append((subject_id, img_file))
    
    print(f"Loading {len(image_files)} images from {directory}")
    
    for subject_id, img_path in image_files:
        try:
            img = Image.open(img_path).convert('L')  # Convert to grayscale
            img = img.resize((img_width, img_height), Image.Resampling.LANCZOS)
            img_array = np.array(img, dtype=np.float32) / 255.0
            
            subject_images[subject_id].append(img_array)
            all_filenames.append(str(img_path))
        except Exception as e:
            print(f"Error loading {img_path}: {e}")
    
    return dict(subject_images), all_filenames


def compute_similarity(img1: np.ndarray, img2: np.ndarray, metric: str = 'correlation') -> float:
    """
    Compute similarity between two images.
    
    Args:
        img1: First image array
        img2: Second image array
        metric: Similarity metric ('correlation', 'mse', or 'cosine')
    
    Returns:
        Similarity score (higher means more similar)
    """
    if metric == 'correlation':
        # Pearson correlation coefficient
        img1_flat = img1.flatten()
        img2_flat = img2.flatten()
        correlation = np.corrcoef(img1_flat, img2_flat)[0, 1]
        return correlation if not np.isnan(correlation) else 0.0
    
    elif metric == 'mse':
        # Mean Squared Error (inverted so higher is more similar)
        mse = np.mean((img1 - img2) ** 2)
        return -mse
    
    elif metric == 'cosine':
        # Cosine similarity
        img1_flat = img1.flatten()
        img2_flat = img2.flatten()
        dot_product = np.dot(img1_flat, img2_flat)
        norm1 = np.linalg.norm(img1_flat)
        norm2 = np.linalg.norm(img2_flat)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)
    
    else:
        raise ValueError(f"Unknown metric: {metric}")


def perform_reidentification_attack(
    original_images: Dict[str, List[np.ndarray]],
    anonymized_images: Dict[str, List[np.ndarray]],
    metric: str = 'correlation'
) -> Tuple[float, Dict]:
    """
    Perform re-identification attack by matching anonymized to original images.
    
    Args:
        original_images: Dict mapping subject_id to list of original images
        anonymized_images: Dict mapping subject_id to list of anonymized images
        metric: Similarity metric to use
    
    Returns:
        Tuple of (attack_success_rate, detailed_results)
    """
    correct_matches = 0
    total_attempts = 0
    results = {
        'matches': [],
        'subject_accuracies': {}
    }
    
    print(f"\nPerforming re-identification attack using {metric} similarity...")
    print("-" * 60)
    
    for anon_subject_id, anon_images in anonymized_images.items():
        subject_correct = 0
        subject_total = 0
        
        for anon_idx, anon_img in enumerate(anon_images):
            # Compute similarity with all original images
            best_match_subject = None
            best_similarity = -float('inf')
            
            similarities = {}
            for orig_subject_id, orig_images in original_images.items():
                # Average similarity across all images of this subject
                subject_similarities = []
                for orig_img in orig_images:
                    sim = compute_similarity(anon_img, orig_img, metric=metric)
                    subject_similarities.append(sim)
                avg_similarity = np.mean(subject_similarities)
                similarities[orig_subject_id] = avg_similarity
                
                if avg_similarity > best_similarity:
                    best_similarity = avg_similarity
                    best_match_subject = orig_subject_id
            
            # Check if the attack succeeded
            is_correct = (best_match_subject == anon_subject_id)
            if is_correct:
                correct_matches += 1
                subject_correct += 1
            
            total_attempts += 1
            subject_total += 1
            
            results['matches'].append({
                'true_subject': anon_subject_id,
                'predicted_subject': best_match_subject,
                'correct': is_correct,
                'similarity': best_similarity,
                'all_similarities': similarities
            })
        
        subject_accuracy = subject_correct / subject_total if subject_total > 0 else 0
        results['subject_accuracies'][anon_subject_id] = subject_accuracy
        print(f"Subject {anon_subject_id}: {subject_correct}/{subject_total} "
              f"correct ({subject_accuracy*100:.1f}%)")
    
    attack_success_rate = correct_matches / total_attempts if total_attempts > 0 else 0
    return attack_success_rate, results


def main():
    parser = argparse.ArgumentParser(
        description="Perform a simple re-identification attack on anonymized faces"
    )
    parser.add_argument(
        '--original-dir',
        type=str,
        default='datasets/yalefaces',
        help='Directory containing original (non-anonymized) images'
    )
    parser.add_argument(
        '--anonymized-dir',
        type=str,
        default='datasets/peep',
        help='Directory containing anonymized images'
    )
    parser.add_argument(
        '--img-width',
        type=int,
        default=100,
        help='Image width'
    )
    parser.add_argument(
        '--img-height',
        type=int,
        default=100,
        help='Image height'
    )
    parser.add_argument(
        '--metric',
        type=str,
        choices=['correlation', 'mse', 'cosine'],
        default='correlation',
        help='Similarity metric to use for matching'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Re-identification Attack")
    print("=" * 60)
    print(f"Original images: {args.original_dir}")
    print(f"Anonymized images: {args.anonymized_dir}")
    print(f"Similarity metric: {args.metric}")
    print("=" * 60)
    
    # Load images
    print("\nLoading original images...")
    original_images, _ = load_images_from_directory(
        args.original_dir,
        args.img_width,
        args.img_height
    )
    print(f"Loaded {len(original_images)} subjects with "
          f"{sum(len(imgs) for imgs in original_images.values())} total images")
    
    print("\nLoading anonymized images...")
    anonymized_images, _ = load_images_from_directory(
        args.anonymized_dir,
        args.img_width,
        args.img_height
    )
    print(f"Loaded {len(anonymized_images)} subjects with "
          f"{sum(len(imgs) for imgs in anonymized_images.values())} total images")
    
    # Perform attack
    success_rate, results = perform_reidentification_attack(
        original_images,
        anonymized_images,
        metric=args.metric
    )
    
    # Print summary
    print("\n" + "=" * 60)
    print("ATTACK RESULTS")
    print("=" * 60)
    print(f"Overall Attack Success Rate: {success_rate*100:.2f}%")
    print(f"Successfully re-identified: {int(success_rate * len(results['matches']))} "
          f"out of {len(results['matches'])} images")
    print("=" * 60)
    
    # Print interpretation
    if success_rate > 0.8:
        print("\nHIGH RISK: The anonymization is vulnerable to re-identification!")
    elif success_rate > 0.5:
        print("\nMODERATE RISK: The anonymization provides limited protection.")
    elif success_rate > 0.3:
        print("\nLOW RISK: The anonymization provides reasonable protection.")
    else:
        print("\nGOOD: The anonymization is resistant to this simple attack.")



if __name__ == '__main__':
    main()

