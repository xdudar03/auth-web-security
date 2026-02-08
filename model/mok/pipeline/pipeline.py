import os
import base64
import argparse

import numpy as np
from PIL import Image

# Import modules from the project
from mok.pipeline.ml_controller import MLController

def run_training(
    data: tuple | None = None,
    img_width: int = 100,
    img_height: int = 100,
) -> MLController:
    """Run the ML training pipeline on provided anonymized data."""
    if data is not None:
        if not isinstance(data, tuple) or len(data) != 3:
            raise ValueError("Expected data as (X, y, label_encoder).")
        X, y, label_encoder = data
        if X is None or y is None or label_encoder is None:
            raise RuntimeError("Invalid training data provided.")
        controller = MLController(data=(X, y, label_encoder))
    else:
        # Fallback: load anonymized vectors from the configured database.
        controller = MLController()
    controller.INPUT_SHAPE = (img_height, img_width, controller.INPUT_SHAPE[2])
    controller.prepare_data()
    controller.create_model()
    controller.train_model()
    return controller


def save_evaluation_artifacts(output: dict, save_dir: str, model_name: str) -> None:
    """Persist evaluation artifacts (report image, curves, confusion matrix)."""
    try:
        os.makedirs(save_dir, exist_ok=True)
        # Save classification report image (base64 -> PNG)
        report_b64 = output.get("classification_report")
        if report_b64:
            report_path = os.path.join(save_dir, f"{model_name}_classification_report.png")
            with open(report_path, "wb") as f:
                f.write(base64.b64decode(report_b64))
            print(f"Saved classification report: {report_path}")

        # Save training curves image (if provided)
        curves_img = output.get("curves")
        if curves_img is not None and isinstance(curves_img, Image.Image):
            curves_path = os.path.join(save_dir, f"{model_name}_training_curves.png")
            try:
                curves_img.save(curves_path)
                print(f"Saved training curves image: {curves_path}")
            except Exception as e:
                print(f"Could not save curves image: {e}")

        # Save confusion matrix as CSV
        cm = output.get("confusion_matrix")
        if cm is not None:
            cm_csv_path = os.path.join(save_dir, f"{model_name}_confusion_matrix.csv")
            try:
                np.savetxt(cm_csv_path, cm, fmt="%d", delimiter=",")
                print(f"Saved confusion matrix CSV: {cm_csv_path}")
            except Exception as e:
                print(f"Could not save confusion matrix CSV: {e}")
    except Exception as e:
        print(f"Error while saving evaluation artifacts: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Train the model using already-anonymized image vectors."
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
    args = parser.parse_args()

    print("\n=== Training ===")
    controller = run_training(
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
        )

    print("\nTraining completed.")
    print(f"Model artifacts directory: {controller._model_save_dir}")

if __name__ == "__main__":
    main()


