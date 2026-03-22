#!/usr/bin/env python3
"""
Train initial model artifacts from embeddings stored in SQLite.

This script writes artifacts under model/prebuilt/trained so they can be
committed to the repository as visible prebuilt model files.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
import shutil


SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_DIR = SCRIPT_DIR.parent
REPO_ROOT = MODEL_DIR.parent

if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from mok.pipeline.ml_controller import MLController


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train initial model artifacts into model/prebuilt/trained"
    )
    parser.add_argument(
        "--db-path",
        default=str(REPO_ROOT / "server" / "data" / "users.db"),
        help="Path to SQLite DB containing embeddings.",
    )
    parser.add_argument(
        "--output-root",
        default=str(SCRIPT_DIR),
        help="Base output directory. Artifacts are written in <output-root>/trained.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="Training epochs for initial prebuild (default: 100).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size for training (default: 16).",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()

    db_path = Path(args.db_path).resolve()
    output_root = Path(args.output_root).resolve()

    if not db_path.exists():
        raise FileNotFoundError(
            f"Database not found: {db_path}. Run DB seeding first, then retry."
        )

    output_root.mkdir(parents=True, exist_ok=True)
    os.environ["SQLITE_DB_PATH"] = str(db_path)

    controller = MLController(db_path=str(db_path), ml_output=str(output_root))
    controller.EPOCHS = int(args.epochs)
    controller.BATCH_SIZE = int(args.batch_size)

    if controller.get_embedding_count() == 0:
        raise RuntimeError(f"No embeddings found in database: {db_path}")

    print(f"Starting initial training from DB: {db_path}")
    print(f"Saving artifacts in: {output_root / 'trained'}")

    train_output = controller.retrain_from_db()
    eval_metrics = (train_output or {}).get("evaluation", {})

    print("Initial prebuilt training completed.")
    if eval_metrics:
        print(
            "Evaluation -> "
            f"accuracy: {eval_metrics.get('accuracy')}, "
            f"loss: {eval_metrics.get('loss')}"
        )

    trained_dir = Path(controller._model_save_dir)
    artifacts = sorted(p.name for p in trained_dir.glob("*") if p.is_file())

    logs_dir = Path(controller._log_dir)
    if logs_dir.exists():
        shutil.rmtree(logs_dir)
    
    # delete all artifacts that include "training" in their name
    for artifact in artifacts:
        if "training" in artifact:
            Path(trained_dir, artifact).unlink()

    print("Generated artifacts:")
    for artifact in artifacts:
        print(f" - {artifact}")


if __name__ == "__main__":
    main()
