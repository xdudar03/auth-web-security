import os
import sys
import io
import base64
import argparse
from typing import Tuple

import numpy as np
from PIL import Image

# Import modules from the project
import mok.privacy.anonymization_process_peep as ap
from mok.preprocessing.image_preprocessing import preprocess_images_yalefaces
from mok.data.data_loader import load_anonymized_images_flat, load_label_encoder
from mok.pipeline.ml_controller import MLController
from mok.config.settings import FOLDER_PATH, OUTPUT_FOLDER
from mok.scripts.dp_svd import run_dp_svd
from mok.scripts.k_same_pixel import run_k_same_pixel
from mok.scripts.anonymize_peep import run_peep

def run_training(
    data_dir: str,
    img_width: int = 100,
    img_height: int = 100,
) -> MLController:
    """Load anonymized images and run the ML training pipeline."""
    X, y, label_encoder = load_anonymized_images_flat(
        data_dir=data_dir,
        img_width=img_width,
        img_height=img_height,
        color_mode='grayscale',
    )
    if X is None or y is None or label_encoder is None:
        raise RuntimeError("Failed to load anonymized images for training.")

    controller = MLController(data=(X, y, label_encoder))
    controller.prepare_data()
    controller.create_model()
    controller.train_model()
    return controller


def save_evaluation_artifacts(output: dict, save_dir: str, model_name: str, method: str) -> None:
    """Persist evaluation artifacts (report image, curves, confusion matrix)."""
    try:
        
        os.makedirs(save_dir, exist_ok=True)
        # Save classification report image (base64 -> PNG)
        report_b64 = output.get("classification_report")
        if report_b64:
            report_path = os.path.join(save_dir, f"{model_name}_{method}_classification_report.png")
            with open(report_path, "wb") as f:
                f.write(base64.b64decode(report_b64))
            print(f"Saved classification report: {report_path}")

        # Save training curves image (if provided)
        curves_img = output.get("curves")
        if curves_img is not None and isinstance(curves_img, Image.Image):
            curves_path = os.path.join(save_dir, f"{model_name}_{method}_training_curves.png")
            try:
                curves_img.save(curves_path)
                print(f"Saved training curves image: {curves_path}")
            except Exception as e:
                print(f"Could not save curves image: {e}")

        # Save confusion matrix as CSV
        cm = output.get("confusion_matrix")
        if cm is not None:
            cm_csv_path = os.path.join(save_dir, f"{model_name}_{method}_confusion_matrix.csv")
            try:
                np.savetxt(cm_csv_path, cm, fmt="%d", delimiter=",")
                print(f"Saved confusion matrix CSV: {cm_csv_path}")
            except Exception as e:
                print(f"Could not save confusion matrix CSV: {e}")
    except Exception as e:
        print(f"Error while saving evaluation artifacts: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="End-to-end pipeline: anonymize images then train the model."
    )
    parser.add_argument(
        "--method",
        type=str,
        choices=["dp_svd", "peep", "k_same_pixel"],
        default="peep",
        help="Anonymization method to use: 'dp_svd' or 'peep' or 'k_same_pixel'.",
    )
    parser.add_argument(
        "--input-dir",
        type=str,
        default=FOLDER_PATH,
        help="Directory containing original images to anonymize (subjects grouped or flat).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=OUTPUT_FOLDER,
        help="Directory where anonymized images will be saved.",
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
        "--n-components-ratio",
        type=float,
        default=0.8,
        help="Ratio of PCA components to keep relative to per-subject sample count.",
    )
    parser.add_argument(
        "--epsilon-projection",
        type=float,
        default=1.0,
        help="Differential privacy epsilon for the noised projection.",
    )
    parser.add_argument(
        "--epsilon-eigenvectors",
        type=float,
        default=10.0,
        help="Differential privacy epsilon for the noised eigenvectors.",
    )
    parser.add_argument(
        "--epsilon-dp-svd",
        type=float,
        default=0.4,
        help="Differential privacy epsilon for the DP-SVD anonymization.",
    )
    parser.add_argument(
        "--k",
        type=int,
        default=10,
        help="Number of images to group for k-same-pixel anonymization.",
    )
    parser.add_argument(
        "--n-singular-values",
        type=int,
        default=15,
        help="Number of singular values to keep for DP-SVD anonymization.",
    )
    parser.add_argument(
        "--block-size",
        type=int,
        default=25,
        help="Size of the blocks for block-based DP-SVD anonymization.",
    )
    args = parser.parse_args()

    image_size = (args.img_height, args.img_width)  # (height, width) for numpy convention

    print(f"\n=== STEP 1/2: Anonymization ({args.method}) ===")
    if args.method == "peep":
        run_peep(
            input_dir=args.input_dir,
            output_dir="datasets/peep",
            image_size=image_size,
            n_components_ratio=args.n_components_ratio,
            epsilon_projection=args.epsilon_projection,
            epsilon_eigenvectors=args.epsilon_eigenvectors,
        )
        anonymized_dir = "datasets/peep"
    elif args.method == "k_same_pixel":
        run_k_same_pixel(
            input_dir=args.input_dir,
            output_dir="datasets/k_same_pixel_faces",
            k=args.k,
            image_size=image_size,
        )
        anonymized_dir = "datasets/k_same_pixel_faces"
    else:
        run_dp_svd(
            input_dir=args.input_dir,
            output_dir="datasets/dp_svd",
            epsilon=args.epsilon_dp_svd,
            n_singular_values=args.n_singular_values,
            block_size=args.block_size,
            image_size=image_size,
        )
        anonymized_dir = "datasets/dp_svd"

    print("\n=== STEP 2/2: Training ===")
    controller = run_training(
        data_dir=anonymized_dir,
        img_width=args.img_width,
        img_height=args.img_height,
    )

    # Display evaluation summary and save artifacts
    if controller.output_train:
        eval_obj = controller.output_train.get("evaluation", {})
        acc = eval_obj.get("accuracy")
        loss = eval_obj.get("loss")
        if acc is not None and loss is not None:
            print(f"\nEvaluation — accuracy: {acc:.4f}, loss: {loss:.4f}")
        save_evaluation_artifacts(
            controller.output_train,
            controller._model_save_dir,
            controller.MODEL_NAME,
            args.method,
        )

    print("\nTraining completed.")
    print(f"Model artifacts directory: {controller._model_save_dir}")

if __name__ == "__main__":
    main()


