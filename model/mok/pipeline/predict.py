from PIL import Image
import numpy as np
from typing import Tuple, List
from mok.pipeline.ml_controller import MLController
import matplotlib.pyplot as plt
import argparse
import os

from mok.scripts.anonymize_peep import run_peep
from mok.scripts.dp_svd import run_dp_svd
from mok.scripts.k_same_pixel import run_k_same_pixel
SUBJECT_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16"]
IMAGE_FILE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp", ".pgm", ".gif")
MY_FACE_DEFAULT_DIR = "datasets/my_face"
MY_FACE_ANON_ROOT = "datasets/my_face_anonymized"

def predict_image(controller: MLController, image_path: str) -> Tuple[str, float]:
    """Run prediction on a single image file using the trained/saved model."""
    with Image.open(image_path) as img:
        image_np = np.array(img.convert("RGB"))
    predicted_label, confidence = controller.predict_image(image_np)
    return predicted_label, confidence

def plot_predictions(validation_results: list, method: str) -> None:

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
    save_path = os.path.join("data/results", f"validation_results_{method}.png")
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


def anonymize_my_face_images(
    method: str,
    input_dir: str,
    output_root: str,
    image_size: Tuple[int, int],
    *,
    epsilon_projection: float = 1.0,
    epsilon_eigenvectors: float = 25.0,
    n_components_ratio: float = 0.8,
    k: int = 5,
    epsilon_dp_svd: float = 0.4,
    n_singular_values: int = 4,
    block_size: int = 20,
) -> str:
    """Apply the chosen anonymization to the my_face dataset before prediction."""
    if method == "none":
        print(f"Skipping additional anonymization for {input_dir}.")
        return input_dir

    os.makedirs(output_root, exist_ok=True)
    method_dir = os.path.join(output_root, method)

    print(
        f"Anonymizing {input_dir} with {method}; results will go to {method_dir}."
    )
    if method == "peep":
        run_peep(
            input_dir=input_dir,
            output_dir=method_dir,
            image_size=image_size,
            n_components_ratio=n_components_ratio,
            epsilon_projection=epsilon_projection,
            epsilon_eigenvectors=epsilon_eigenvectors,
        )
    elif method == "k_same_pixel":
        run_k_same_pixel(
            input_dir=input_dir,
            output_dir=method_dir,
            image_size=image_size,
            k=k,
        )
    elif method == "dp_svd":
        run_dp_svd(
            input_dir=input_dir,
            output_dir=method_dir,
            image_size=image_size,
            epsilon=epsilon_dp_svd,
            n_singular_values=n_singular_values,
            block_size=block_size,
        )
    else:
        raise ValueError(f"Unsupported anonymization method: {method}")
    print(f"Anonymization complete; images available in {method_dir}")
    return method_dir

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run validation predictions on the anonymized training data and the user face variants."
    )
    parser.add_argument("--method", type=str, choices=["peep", "k_same_pixel", "dp_svd"], default="peep")
    parser.add_argument("--my-face-dir", type=str, default=MY_FACE_DEFAULT_DIR)
    parser.add_argument("--my-face-subject-id", type=str, default="16")
    parser.add_argument(
        "--my-face-anonymization",
        type=str,
        choices=["none", "peep", "k_same_pixel", "dp_svd"],
        default="none",
        help="Overrides the anonymization used for --my-face-dir (default: same as --method).",
    )
    parser.add_argument("--my-face-anonymized-dir", type=str, default=MY_FACE_ANON_ROOT)
    parser.add_argument("--my-face-width", type=int, default=100)
    parser.add_argument("--my-face-height", type=int, default=100)
    parser.add_argument("--my-face-n-components-ratio", type=float, default=0.8)
    parser.add_argument("--my-face-epsilon-projection", type=float, default=1.0)
    parser.add_argument("--my-face-epsilon-eigenvectors", type=float, default=10.0)
    parser.add_argument("--my-face-k", type=int, default=10)
    parser.add_argument("--my-face-epsilon-dp-svd", type=float, default=0.25)
    parser.add_argument("--my-face-n-singular-values", type=int, default=4)
    parser.add_argument("--my-face-block-size", type=int, default=20)
    args = parser.parse_args()
    my_face_anonymization = args.my_face_anonymization
    if my_face_anonymization == "none":
        my_face_anonymization = args.method

    if args.method == "peep":
        IMAGE_FOLDER = "datasets/peep"
    elif args.method == "k_same_pixel":
        IMAGE_FOLDER = "datasets/k_same_pixel_faces"
    elif args.method == "dp_svd":
        IMAGE_FOLDER = "datasets/dp_svd"
    else:
        raise ValueError(f"Invalid method: {args.method}")

    controller = MLController()
    validation_results = []
    # predict the images for each subject, images are the same used for training
    for subject_id in SUBJECT_IDS:
        image_path = f"{IMAGE_FOLDER}/{subject_id}_1.png"
        predicted_label, confidence = predict_image(controller, image_path)
        confidenceToFloat = float(confidence)
        validation_results.append({"predicted_label": predicted_label == subject_id, "confidence": f"{confidenceToFloat:.4f}"})
        print(f"Validation result for {subject_id}: {predicted_label == subject_id}")
        print(f"Predicted label: {predicted_label}, Confidence: {confidenceToFloat:.4f}")

    my_face_source = anonymize_my_face_images(
        method=my_face_anonymization,
        input_dir=args.my_face_dir,
        output_root=args.my_face_anonymized_dir,
        image_size=(args.my_face_width, args.my_face_height),
        epsilon_projection=args.my_face_epsilon_projection,
        epsilon_eigenvectors=args.my_face_epsilon_eigenvectors,
        n_components_ratio=args.my_face_n_components_ratio,
        k=args.my_face_k,
        epsilon_dp_svd=args.my_face_epsilon_dp_svd,
        n_singular_values=args.my_face_n_singular_values,
        block_size=args.my_face_block_size,
    )

    subject_id = args.my_face_subject_id
    validation_results_new = []
    image_files = list_image_files(my_face_source)
    print(
        f"Predicting {len(image_files)} variant(s) for subject {subject_id} "
        f"(anonymization: {my_face_anonymization})"
    )
    for image_name in image_files:
        image_path = os.path.join(my_face_source, image_name)
        print(f"Predicting image: {image_name}")
        predicted_label, confidence = predict_image(controller, image_path)
        confidenceToFloat = float(confidence)
        validation_results_new.append({"predicted_label": predicted_label == subject_id, "confidence": f"{confidenceToFloat:.4f}"})
        print(f"Validation result for {subject_id}: {predicted_label == subject_id}")
        print(f"Predicted label: {predicted_label}, Confidence: {confidenceToFloat:.4f}")

    print(f"Validation results: {validation_results}")
    plot_predictions(validation_results, args.method)
    print(f"Validation results for new images ({my_face_anonymization}): {validation_results_new}")
    plot_predictions(validation_results_new, f"my_face_{my_face_anonymization}")