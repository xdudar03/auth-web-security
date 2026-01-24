"""
Membership Inference Attack
============================

This script implements a simple membership inference attack that attempts to
determine whether a specific face image was used during model training.

The attack works by:
1. Loading a trained facial recognition model
2. Computing confidence scores for images
3. Using confidence as a signal to distinguish training vs non-training images
4. Evaluating attack accuracy against known training/test splits
"""

import os
import argparse
import numpy as np
from pathlib import Path
from PIL import Image
from typing import Tuple, Dict, List
from tensorflow.keras.models import load_model
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc, confusion_matrix

from mok.data.data_loader import load_label_encoder, load_anonymized_images_flat


def load_trained_model(
    model_name: str,
    model_save_dir: str = 'data/ml_models/trained',
) -> Tuple:
    """
    Load a trained model and its label encoder.
    
    Args:
        model_save_dir: Directory containing the model
        model_name: Name of the model file (without .h5 extension)
    
    Returns:
        Tuple of (model, label_encoder)
    """
    model_filepath = os.path.join(model_save_dir, f"{model_name}.h5")
    encoder_filepath = os.path.join(model_save_dir, f"{model_name}_label_encoder.joblib")
    
    if not os.path.exists(model_filepath):
        raise FileNotFoundError(f"Model not found: {model_filepath}")
    if not os.path.exists(encoder_filepath):
        raise FileNotFoundError(f"Encoder not found: {encoder_filepath}")
    
    print(f"Loading model from: {model_filepath}")
    model = load_model(model_filepath)
    label_encoder = load_label_encoder(encoder_filepath)
    
    return model, label_encoder


def get_prediction_confidence(
    model,
    images: np.ndarray,
    true_labels: np.ndarray = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Get prediction confidence scores for images.
    
    Args:
        model: Trained Keras model
        images: Array of images (N, H, W, C)
        true_labels: Optional true labels for computing correct-class confidence
    
    Returns:
        Tuple of (max_confidences, correct_class_confidences)
    """
    # Get predictions
    predictions = model.predict(images, verbose=0)
    
    # Maximum confidence (regardless of correctness)
    max_confidences = np.max(predictions, axis=1)
    
    # Confidence on the true class (if labels provided)
    correct_class_confidences = None
    if true_labels is not None:
        correct_class_confidences = predictions[np.arange(len(predictions)), true_labels]
    
    return max_confidences, correct_class_confidences


def perform_membership_inference_attack(
    model,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    use_correct_class: bool = True
) -> Dict:
    """
    Perform membership inference attack using confidence scores.
    
    The attack assumes: higher confidence → likely in training set
    
    Args:
        model: Trained model
        X_train: Training images
        y_train: Training labels
        X_test: Test images
        y_test: Test labels
        use_correct_class: If True, use confidence on correct class; else use max confidence
    
    Returns:
        Dictionary with attack results and metrics
    """
    print("\nPerforming membership inference attack...")
    print("-" * 60)
    
    # Get confidence scores for training data
    print("Computing confidence scores for training data...")
    train_max_conf, train_correct_conf = get_prediction_confidence(model, X_train, y_train)
    
    # Get confidence scores for test data
    print("Computing confidence scores for test data...")
    test_max_conf, test_correct_conf = get_prediction_confidence(model, X_test, y_test)
    
    # Choose which confidence metric to use
    if use_correct_class:
        train_scores = train_correct_conf
        test_scores = test_correct_conf
        metric_name = "Correct-class confidence"
    else:
        train_scores = train_max_conf
        test_scores = test_max_conf
        metric_name = "Maximum confidence"
    
    print(f"\nUsing {metric_name} as membership signal")
    print(f"Training data: mean={np.mean(train_scores):.4f}, std={np.std(train_scores):.4f}")
    print(f"Test data:     mean={np.mean(test_scores):.4f}, std={np.std(test_scores):.4f}")
    
    # Create labels: 1 = training (member), 0 = test (non-member)
    true_membership = np.concatenate([
        np.ones(len(train_scores)),   # Training samples are members
        np.zeros(len(test_scores))     # Test samples are non-members
    ])
    
    # Combine confidence scores
    all_scores = np.concatenate([train_scores, test_scores])
    
    # Simple threshold-based attack: classify as "training" if confidence > threshold
    # We'll try the median as a simple threshold
    threshold = np.median(all_scores)
    predicted_membership = (all_scores > threshold).astype(int)
    
    # Calculate accuracy
    accuracy = np.mean(predicted_membership == true_membership)
    
    # Calculate ROC curve
    fpr, tpr, thresholds = roc_curve(true_membership, all_scores)
    roc_auc = auc(fpr, tpr)
    
    # Find optimal threshold (Youden's index)
    optimal_idx = np.argmax(tpr - fpr)
    optimal_threshold = thresholds[optimal_idx]
    optimal_predictions = (all_scores > optimal_threshold).astype(int)
    optimal_accuracy = np.mean(optimal_predictions == true_membership)
    
    # Calculate confusion matrix with optimal threshold
    cm = confusion_matrix(true_membership, optimal_predictions)
    
    # Calculate precision and recall
    tn, fp, fn, tp = cm.ravel()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    results = {
        'metric_name': metric_name,
        'train_scores': train_scores,
        'test_scores': test_scores,
        'threshold': threshold,
        'optimal_threshold': optimal_threshold,
        'accuracy': accuracy,
        'optimal_accuracy': optimal_accuracy,
        'roc_auc': roc_auc,
        'fpr': fpr,
        'tpr': tpr,
        'thresholds': thresholds,
        'confusion_matrix': cm,
        'precision': precision,
        'recall': recall,
        'f1_score': f1_score,
        'true_membership': true_membership,
        'all_scores': all_scores,
    }
    
    return results


def plot_attack_results(results: Dict, save_path: str = None):
    """Plot attack results including confidence distributions and ROC curve."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    
    # Plot 1: Confidence distribution
    ax1 = axes[0]
    ax1.hist(results['train_scores'], bins=30, alpha=0.6, label='Training (Member)', color='blue')
    ax1.hist(results['test_scores'], bins=30, alpha=0.6, label='Test (Non-member)', color='red')
    ax1.axvline(results['optimal_threshold'], color='green', linestyle='--', 
                label=f'Optimal Threshold={results["optimal_threshold"]:.3f}')
    ax1.set_xlabel('Confidence Score')
    ax1.set_ylabel('Frequency')
    ax1.set_title(f'{results["metric_name"]} Distribution')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Plot 2: ROC Curve
    ax2 = axes[1]
    ax2.plot(results['fpr'], results['tpr'], color='darkorange', lw=2,
             label=f'ROC curve (AUC = {results["roc_auc"]:.3f})')
    ax2.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--', label='Random Guess')
    ax2.set_xlim([0.0, 1.0])
    ax2.set_ylim([0.0, 1.05])
    ax2.set_xlabel('False Positive Rate')
    ax2.set_ylabel('True Positive Rate')
    ax2.set_title('ROC Curve')
    ax2.legend(loc="lower right")
    ax2.grid(True, alpha=0.3)
    
    # Plot 3: Confusion Matrix
    ax3 = axes[2]
    cm = results['confusion_matrix']
    im = ax3.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax3.figure.colorbar(im, ax=ax3)
    ax3.set(xticks=np.arange(cm.shape[1]),
            yticks=np.arange(cm.shape[0]),
            xticklabels=['Non-member', 'Member'],
            yticklabels=['Non-member', 'Member'],
            title='Confusion Matrix',
            ylabel='True label',
            xlabel='Predicted label')
    
    # Add text annotations to confusion matrix
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax3.text(j, i, format(cm[i, j], 'd'),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black")
    
    plt.tight_layout()
    
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"\nPlot saved to: {save_path}")
    
    plt.show()


def main():
    parser = argparse.ArgumentParser(
        description="Perform membership inference attack on trained face recognition model"
    )
    parser.add_argument(
        '--data-dir',
        type=str,
        default='datasets/peep',
        help='Directory containing anonymized images used for training'
    )
    parser.add_argument(
        '--model-dir',
        type=str,
        default='data/ml_models/trained',
        help='Directory containing the trained model'
    )
    parser.add_argument(
        '--model-name',
        type=str,
        required=True,
        default='simple_cnn_yale_peep_v1',
        help='Name of the model'
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
        '--use-max-confidence',
        action='store_true',
        help='Use maximum confidence instead of correct-class confidence'
    )
    parser.add_argument(
        '--save-plot',
        type=str,
        default='data/results/membership_inference_attack.png',
        help='Path to save the results plot'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Membership Inference Attack")
    print("=" * 60)
    print(f"Data directory: {args.data_dir}")
    print(f"Model: {args.model_name}")
    print("=" * 60)
    
    # Load the trained model
    model, label_encoder = load_trained_model(model_name=args.model_name, model_save_dir=args.model_dir)
    
    # Load the dataset (this should be the same data used for training)
    print("\nLoading dataset...")
    X, y, _ = load_anonymized_images_flat(
        data_dir=args.data_dir,
        img_width=args.img_width,
        img_height=args.img_height,
        color_mode='grayscale',
    )
    
    if X is None or y is None:
        raise RuntimeError("Failed to load images")
    
    print(f"Loaded {len(X)} images from {len(np.unique(y))} subjects")
    
    # Split into train/test using the same strategy as training
    # Note: This is a simplified version. Ideally, we'd load the exact splits used during training
    from sklearn.model_selection import train_test_split
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )
    
    print(f"Training set: {len(X_train)} images")
    print(f"Test set: {len(X_test)} images")
    
    # Perform the attack
    results = perform_membership_inference_attack(
        model,
        X_train,
        y_train,
        X_test,
        y_test,
        use_correct_class=not args.use_max_confidence
    )
    
    # Print results
    print("\n" + "=" * 60)
    print("ATTACK RESULTS")
    print("=" * 60)
    print(f"Attack Accuracy (median threshold): {results['accuracy']*100:.2f}%")
    print(f"Attack Accuracy (optimal threshold): {results['optimal_accuracy']*100:.2f}%")
    print(f"ROC AUC: {results['roc_auc']:.4f}")
    print(f"Precision: {results['precision']:.4f}")
    print(f"Recall: {results['recall']:.4f}")
    print(f"F1-Score: {results['f1_score']:.4f}")
    print("=" * 60)
    
    # Interpret results
    if results['roc_auc'] > 0.8:
        print("\nHIGH RISK: Model is highly vulnerable to membership inference!")
        print("    An attacker can reliably determine if an image was used for training.")
    elif results['roc_auc'] > 0.65:
        print("\nMODERATE RISK: Model leaks some membership information.")
        print("    An attacker has better than random chance of identifying training data.")
    elif results['roc_auc'] > 0.55:
        print("\nLOW RISK: Model provides some protection against membership inference.")
    else:
        print("\nGOOD: Model is resistant to this membership inference attack.")
        print("    Attack performs close to random guessing.")
    
    print("\nNote: Random guessing would achieve ~50% accuracy and AUC ≈ 0.5")
    print("Higher AUC means the model leaks more information about training membership.")
    
    # Plot results
    plot_attack_results(results, save_path=args.save_plot)


if __name__ == '__main__':
    main()

