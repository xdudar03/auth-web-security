import os
import io
import json
import base64
import sqlite3
import time
import numpy as np
from PIL import Image



_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DEFAULT_DB_PATH = os.path.join(_REPO_ROOT, "server", "data", "users.db")
SQLITE_TIMEOUT_SECONDS = float(os.environ.get("MODEL_SQLITE_TIMEOUT_SECONDS", "10"))
SQLITE_LOCK_RETRY_ATTEMPTS = int(os.environ.get("MODEL_SQLITE_LOCK_RETRY_ATTEMPTS", "5"))
SQLITE_LOCK_RETRY_BASE_DELAY_SECONDS = float(
    os.environ.get("MODEL_SQLITE_LOCK_RETRY_BASE_DELAY_SECONDS", "0.1")
)


class DatabaseController:

    _embeddings_table_name = "user_embeddings"
    _embeddings_user_id = "userId"
    _embeddings_customer_id = "customerId"
    _embeddings_data = "embedding"

    # Dataset directories
    ORIGINAL_DIR = "dataset-yalefaces"        # original YaleFaces images
    ANONYMIZED_DIR = "dataset-peep"  # anonymized images (output of pipeline)

    DEFAULT_DB_PATH = DEFAULT_DB_PATH

    def __init__(self, path=DEFAULT_DB_PATH):
        shared_path = os.environ.get("SQLITE_DB_PATH")
        resolved_path = shared_path.strip() if shared_path else path
        self.path = os.path.abspath(resolved_path)
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        # Log in the database
        self.conn = sqlite3.connect(self.path, timeout=SQLITE_TIMEOUT_SECONDS)
        self.cursor = self.conn.cursor()
        # Allow concurrent reads/writes across Node + model processes.
        self.cursor.execute("PRAGMA journal_mode=WAL")
        self.cursor.execute(
            f"PRAGMA busy_timeout={int(SQLITE_TIMEOUT_SECONDS * 1000)}"
        )
        self.cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {self._embeddings_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                {self._embeddings_user_id} TEXT,
                {self._embeddings_customer_id} TEXT,
                {self._embeddings_data} TEXT NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                CHECK (
                    ({self._embeddings_user_id} IS NOT NULL AND {self._embeddings_customer_id} IS NULL) OR
                    ({self._embeddings_user_id} IS NULL AND {self._embeddings_customer_id} IS NOT NULL)
                )
            )
        ''')
        self.conn.commit()
    def __del__(self):
        # Close database connexions
        self.conn.commit()
        self.conn.close()

    def add_embedding(self, user_id: str, embedding):
        if isinstance(embedding, np.ndarray):
            serialized = json.dumps(embedding.tolist())
        elif isinstance(embedding, (list, tuple)):
            serialized = json.dumps(list(embedding))
        else:
            serialized = str(embedding)
        print(f"Serialized embedding: {serialized}")
        is_customer = isinstance(user_id, str) and user_id.startswith("c")
        target_column = (
            self._embeddings_customer_id if is_customer else self._embeddings_user_id
        )
        for attempt in range(1, SQLITE_LOCK_RETRY_ATTEMPTS + 1):
            try:
                self.cursor.execute(
                    f"INSERT INTO {self._embeddings_table_name} ({target_column}, {self._embeddings_data}) VALUES (?, ?)",
                    (user_id, serialized),
                )
                self.conn.commit()
                return self.cursor.lastrowid
            except sqlite3.OperationalError as error:
                message = str(error).lower()
                is_locked = "database is locked" in message or "database is busy" in message
                if not is_locked or attempt == SQLITE_LOCK_RETRY_ATTEMPTS:
                    raise
                delay = SQLITE_LOCK_RETRY_BASE_DELAY_SECONDS * attempt
                print(
                    f"SQLite locked while adding embedding; retry {attempt}/{SQLITE_LOCK_RETRY_ATTEMPTS} in {delay:.2f}s"
                )
                time.sleep(delay)

    def get_user_id_list(self):
        self.cursor.execute(f"""
            SELECT DISTINCT COALESCE({self._embeddings_user_id}, {self._embeddings_customer_id})
            FROM {self._embeddings_table_name}
        """)
        result = self.cursor.fetchall()
        return [row[0] for row in result if row[0] is not None] # Send IDs

    def get_user_vectors(self):
        self.cursor.execute(
            f"SELECT {self._embeddings_data} FROM {self._embeddings_table_name}"
        )
        result = self.cursor.fetchall()
        return [row[0] for row in result]

    def get_embeddings_table(self):
        self.cursor.execute(f"""
            SELECT COALESCE({self._embeddings_user_id}, {self._embeddings_customer_id}) AS subjectId,
                   {self._embeddings_data}
            FROM {self._embeddings_table_name}
        """)
        return self.cursor.fetchall()

    def get_embeddings_for_subject(self, subject_id: str):
        self.cursor.execute(
            f"""
            SELECT {self._embeddings_data}
            FROM {self._embeddings_table_name}
            WHERE {self._embeddings_user_id} = ? OR {self._embeddings_customer_id} = ?
            """,
            (subject_id, subject_id),
        )
        return [row[0] for row in self.cursor.fetchall()]


    def reset_database(self):
        # Only reset model tables to avoid wiping shared DB
        self.conn.commit()
        self.cursor.execute(f"DROP TABLE IF EXISTS {self._embeddings_table_name}")
        self.conn.commit()
        # Recreate tables
        self.cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {self._embeddings_table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                {self._embeddings_user_id} TEXT,
                {self._embeddings_customer_id} TEXT,
                {self._embeddings_data} TEXT NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                CHECK (
                    ({self._embeddings_user_id} IS NOT NULL AND {self._embeddings_customer_id} IS NULL) OR
                    ({self._embeddings_user_id} IS NULL AND {self._embeddings_customer_id} IS NOT NULL)
                )
            )
        ''')
        self.conn.commit()
        return


    def process_dataset(self, user_to_images_b64: dict[str, list[str]]):
        """Reset the DB and insert one row per user with their images encoded in base64."""
        self.reset_database()
        for _user_id, images_b64 in user_to_images_b64.items():
            if not _user_id:
                continue
            images_b64 = np.array(images_b64)
            self.add_embedding(_user_id, images_b64)


    def load_anonymized_dataset_from_folder(self, directory: str | None = None):
        """
        Load anonymized images from a flat folder and populate the database.

        Expected filename pattern: "<subject_id>_<index>.png"
        Groups images by <subject_id> and saves one row per subject.
        """
        target_dir = directory or self.ANONYMIZED_DIR
        if not os.path.isdir(target_dir):
            raise FileNotFoundError(f"Anonymized dataset folder not found: {target_dir}")

        user_to_images_b64: dict[str, list[str]] = {}
        png_files = [f for f in os.listdir(target_dir) if f.lower().endswith('.png')]
        for filename in png_files:
            parts = filename.split('_')
            if len(parts) < 2:
                # Unexpected naming, skip
                continue
            subject_id = parts[0]
            file_path = os.path.join(target_dir, filename)
            try:
                with Image.open(file_path) as img:
                    buffer = io.BytesIO()
                    img.save(buffer, format="PNG")
                    img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                user_to_images_b64.setdefault(subject_id, []).append(img_b64)
            except Exception as e:
                print(f"Failed to process '{filename}': {e}")

        if not user_to_images_b64:
            raise RuntimeError(f"No valid anonymized images found in {target_dir}")

        self.process_dataset(user_to_images_b64)





