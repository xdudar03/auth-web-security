from PIL import Image
import numpy as np
from typing import Tuple, List
from mok.pipeline.ml_controller import MLController
import matplotlib.pyplot as plt
import argparse
import os

SUBJECT_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"]
IMAGE_FILE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp", ".pgm", ".gif")

def predict_image(controller: MLController, image_path: str) -> Tuple[str, float]:
    """Run prediction on a single image file using the trained/saved model."""
    with Image.open(image_path) as img:
        image_np = np.array(img.convert("RGB"))
    predicted_label, confidence = controller.predict_image(image_np)
    return predicted_label, confidence

def plot_predictions(validation_results: list) -> None:

    plt.figure(figsize=(10, 4))
    # Create a bar chart of the validation results
    success_results = [1 if result["predicted_label"] else 0 for result in validation_results]
    failure_results = [0 if result["predicted_label"] else 1 for result in validation_results]
    confidence_results = [float(result["confidence"]) for result in validation_results]

    plt.ylim(min(confidence_results) - 0.01, max(confidence_results) + 0.01)
    plt.plot(range(1, len(validation_results) + 1), confidence_results, color="blue")
    plt.bar(range(1, len(success_results) + 1), success_results, color="green")
    plt.bar(range(1, len(failure_results) + 1), failure_results, bottom=success_results, color="red")

    plt.legend(["Confidence", "Success", "Failure"])
    plt.title("Validation Results")
    plt.xlabel("Subject ID")
    plt.ylabel("Confidence")    

    # Save the plot to a file
    os.makedirs("data/results", exist_ok=True)
    save_path = os.path.join("data/results", f"validation_results.png")
    plt.savefig(save_path)
    plt.close()   


def list_image_files(folder: str) -> List[str]:
    """Return sorted image filenames filtered by allowed extensions."""
    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Image folder does not exist: {folder}")
    entries = sorted(os.listdir(folder))
    return [
        entry
        for entry in entries
        if os.path.isfile(os.path.join(folder, entry))
        and entry.lower().endswith(IMAGE_FILE_EXTENSIONS)
    ]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run validation predictions on the anonymized training data."
    )
    parser.add_argument("--input-dir", type=str, default="datasets/yalefaces")
    args = parser.parse_args()
   
    controller = MLController()
    validation_results = []
    image_folder = args.input_dir
    # predict the images for each subject, images are the same used for training
    for subject_id in SUBJECT_IDS:
        image_path = f"{image_folder}/{subject_id}_1.png"
        predicted_label, confidence = predict_image(controller, image_path)
        confidenceToFloat = float(confidence)
        validation_results.append({"predicted_label": predicted_label == subject_id, "confidence": f"{confidenceToFloat:.4f}"})
        print(f"Validation result for {subject_id}: {predicted_label == subject_id}")
        print(f"Predicted label: {predicted_label}, Confidence: {confidenceToFloat:.4f}")

    print(f"Validation results: {validation_results}")
    plot_predictions(validation_results)