"""
Run All Anonymization Methods
==============================

This script runs all three anonymization methods (PEEP, DP-SVD, K-Same-Pixel)
through the pipeline one by one, training separate models for each method.

Each model is saved with a unique name based on the anonymization method used.
"""

import os
import sys
import argparse
from typing import Dict, Any

# Import pipeline components
from mok.scripts.dp_svd import run_dp_svd
from mok.scripts.k_same_pixel import run_k_same_pixel
from mok.scripts.anonymize_peep import run_peep
from mok.data.data_loader import load_anonymized_images_flat
from mok.pipeline.ml_controller import MLController
from mok.config.settings import FOLDER_PATH


def run_single_method(
    method: str,
    input_dir: str,
    img_width: int,
    img_height: int,
    anonymization_params: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run a single anonymization method followed by model training.
    
    Args:
        method: Anonymization method ('peep', 'dp_svd', or 'k_same_pixel')
        input_dir: Directory containing original images
        img_width: Target image width
        img_height: Target image height
        anonymization_params: Dictionary of anonymization parameters
    
    Returns:
        Dictionary with results including controller and model path
    """
    image_size = (img_height, img_width)
    
    print("\n" + "=" * 70)
    print(f"RUNNING METHOD: {method.upper()}")
    print("=" * 70)
    
    # Step 1: Anonymization
    print(f"\n[1/2] Anonymizing images using {method}...")
    print("-" * 70)
    
    if method == "peep":
        anonymized_dir = "datasets/peep"
        run_peep(
            input_dir=input_dir,
            output_dir=anonymized_dir,
            image_size=image_size,
            n_components_ratio=anonymization_params.get('n_components_ratio', 0.8),
            epsilon_projection=anonymization_params.get('epsilon_projection', 1.0),
            epsilon_eigenvectors=anonymization_params.get('epsilon_eigenvectors', 10.0),
        )
    elif method == "dp_svd":
        anonymized_dir = "datasets/dp_svd"
        run_dp_svd(
            input_dir=input_dir,
            output_dir=anonymized_dir,
            epsilon=anonymization_params.get('epsilon_dp_svd', 0.4),
            n_singular_values=anonymization_params.get('n_singular_values', 15),
            block_size=anonymization_params.get('block_size', 25),
            image_size=image_size,
        )
    elif method == "k_same_pixel":
        anonymized_dir = "datasets/k_same_pixel_faces"
        run_k_same_pixel(
            input_dir=input_dir,
            output_dir=anonymized_dir,
            k=anonymization_params.get('k', 10),
            image_size=image_size,
        )
    else:
        raise ValueError(f"Unknown method: {method}")
    
    print(f"✓ Anonymization complete. Output: {anonymized_dir}")
    
    # Step 2: Training
    print(f"\n[2/2] Training model on {method} anonymized data...")
    print("-" * 70)
    
    # Load anonymized images
    X, y, label_encoder = load_anonymized_images_flat(
        data_dir=anonymized_dir,
        img_width=img_width,
        img_height=img_height,
        color_mode='grayscale',
    )
    
    if X is None or y is None or label_encoder is None:
        raise RuntimeError(f"Failed to load anonymized images from {anonymized_dir}")
    
    print(f"Loaded {len(X)} images from {len(set(y))} subjects")
    
    # Create controller with custom model name
    model_name = f"simple_cnn_yale_{method}_v1"
    controller = MLController(data=(X, y, label_encoder))
    
    # Override the MODEL_NAME to include the method
    controller.MODEL_NAME = model_name
    
    # Run training pipeline
    print(f"Model name: {model_name}")
    controller.prepare_data()
    controller.create_model()
    controller.train_model()
    
    # Get evaluation metrics
    eval_results = {}
    if controller.output_train:
        eval_obj = controller.output_train.get("evaluation", {})
        acc = eval_obj.get("accuracy")
        loss = eval_obj.get("loss")
        eval_results['accuracy'] = acc
        eval_results['loss'] = loss
        
        if acc is not None and loss is not None:
            print(f"\n✓ Training complete!")
            print(f"  Evaluation — Accuracy: {acc:.4f}, Loss: {loss:.4f}")
    
    model_path = os.path.join(controller._model_save_dir, f"{model_name}.h5")
    print(f"  Model saved to: {model_path}")
    
    return {
        'method': method,
        'model_name': model_name,
        'model_path': model_path,
        'controller': controller,
        'anonymized_dir': anonymized_dir,
        'evaluation': eval_results,
        'training_time': controller.duration
    }


def main():
    parser = argparse.ArgumentParser(
        description="Run all anonymization methods through the pipeline and train separate models."
    )
    parser.add_argument(
        "--input-dir",
        type=str,
        default=FOLDER_PATH,
        help="Directory containing original images to anonymize.",
    )
    parser.add_argument(
        "--img-width",
        type=int,
        default=100,
        help="Target image width (pixels).",
    )
    parser.add_argument(
        "--img-height",
        type=int,
        default=100,
        help="Target image height (pixels).",
    )
    parser.add_argument(
        "--methods",
        type=str,
        nargs='+',
        choices=["peep", "dp_svd", "k_same_pixel"],
        default=["peep", "dp_svd", "k_same_pixel"],
        help="Methods to run (default: all three).",
    )
    
    # PEEP parameters
    parser.add_argument(
        "--n-components-ratio",
        type=float,
        default=0.8,
        help="PEEP: Ratio of PCA components to keep.",
    )
    parser.add_argument(
        "--epsilon-projection",
        type=float,
        default=1.0,
        help="PEEP: Differential privacy epsilon for projection.",
    )
    parser.add_argument(
        "--epsilon-eigenvectors",
        type=float,
        default=10.0,
        help="PEEP: Differential privacy epsilon for eigenvectors.",
    )
    
    # DP-SVD parameters
    parser.add_argument(
        "--epsilon-dp-svd",
        type=float,
        default=0.4,
        help="DP-SVD: Differential privacy epsilon.",
    )
    parser.add_argument(
        "--n-singular-values",
        type=int,
        default=15,
        help="DP-SVD: Number of singular values to keep.",
    )
    parser.add_argument(
        "--block-size",
        type=int,
        default=25,
        help="DP-SVD: Block size for block-based approach.",
    )
    
    # K-Same-Pixel parameters
    parser.add_argument(
        "--k",
        type=int,
        default=10,
        help="K-Same-Pixel: Number of images to group.",
    )
    
    args = parser.parse_args()
    
    # Collect anonymization parameters
    anonymization_params = {
        'n_components_ratio': args.n_components_ratio,
        'epsilon_projection': args.epsilon_projection,
        'epsilon_eigenvectors': args.epsilon_eigenvectors,
        'epsilon_dp_svd': args.epsilon_dp_svd,
        'n_singular_values': args.n_singular_values,
        'block_size': args.block_size,
        'k': args.k,
    }
    
    print("\n" + "=" * 70)
    print("RUNNING ALL ANONYMIZATION METHODS PIPELINE")
    print("=" * 70)
    print(f"Input directory: {args.input_dir}")
    print(f"Image size: {args.img_width}x{args.img_height}")
    print(f"Methods to run: {', '.join(args.methods)}")
    print("=" * 70)
    
    # Run each method
    results = []
    for method in args.methods:
        try:
            result = run_single_method(
                method=method,
                input_dir=args.input_dir,
                img_width=args.img_width,
                img_height=args.img_height,
                anonymization_params=anonymization_params
            )
            results.append(result)
        except Exception as e:
            print(f"\n❌ ERROR running {method}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    # Print summary
    print("\n\n" + "=" * 70)
    print("SUMMARY OF ALL RUNS")
    print("=" * 70)
    
    if not results:
        print("❌ No methods completed successfully.")
        return
    
    print(f"\nSuccessfully completed: {len(results)}/{len(args.methods)} methods\n")
    
    for result in results:
        method = result['method']
        model_name = result['model_name']
        model_path = result['model_path']
        eval_results = result['evaluation']
        training_time = result['training_time']
        
        print(f"Method: {method.upper()}")
        print(f"  Model: {model_name}")
        print(f"  Path: {model_path}")
        if eval_results.get('accuracy') is not None:
            print(f"  Accuracy: {eval_results['accuracy']:.4f}")
            print(f"  Loss: {eval_results['loss']:.4f}")
        print(f"  Training time: {training_time:.2f}s")
        print()
    
    print("=" * 70)
    print("✓ ALL METHODS COMPLETED!")
    print("=" * 70)
    
    # Print model locations
    print("\nTrained models are saved in: data/ml_models/trained/")
    print("Models:")
    for result in results:
        print(f"  - {result['model_name']}.h5")


if __name__ == "__main__":
    main()

