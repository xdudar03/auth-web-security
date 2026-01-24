import os
import io
import json
import base64
import sqlite3
import numpy as np
from PIL import Image



class DatabaseController:

    _table_name = "noised_user_components"
    _column_id = "id"
    _column_data = "array"

    # Dataset directories
    ORIGINAL_DIR = "dataset-yalefaces"        # original YaleFaces images
    ANONYMIZED_DIR = "dataset-peep"  # anonymized images (output of pipeline)

    def __init__(self, path=os.path.join("data", "gui_database.db")):
        self.path = os.path.abspath(path)
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        # Log in the database
        self.conn = sqlite3.connect(self.path)
        self.cursor = self.conn.cursor()
        # Create noised user table
        self.cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {self._table_name} (
                {self._column_id} INTEGER PRIMARY KEY AUTOINCREMENT,
                {self._column_data} TEXT
            )
        ''')
    def __del__(self):
        # Close database connexions
        self.conn.commit()
        self.conn.close()

    def add_user(self, noised_vectors: np.ndarray):
        json_array = json.dumps(noised_vectors.tolist())
        self.cursor.execute(f"INSERT INTO {self._table_name} ({self._column_data}) VALUES (?)",(json_array,))
        self.conn.commit()
        return self.cursor.lastrowid # Send user id

    def get_user(self, id) -> np.ndarray:
        self.cursor.execute(f"SELECT {self._column_data} FROM {self._table_name} WHERE {self._column_id} = (?)", (id,))
        result = self.cursor.fetchone()
        if result:
            retrieved_json = result[0]
            retrieved_array = np.array(json.loads(retrieved_json))
            return retrieved_array # Send user data
        return None # No user with this id

    def update_user(self, id, new_noised_vectors: np.ndarray):
        json_array = json.dumps(new_noised_vectors.tolist())
        self.cursor.execute(f"UPDATE {self._table_name} SET {self._column_data} = (?) WHERE {self._column_id} = (?)",(json_array, id))
        self.conn.commit()
        return self.cursor.rowcount # Number of affected rows

    def delete_user(self, id):
        self.cursor.execute(f"DELETE FROM {self._table_name} WHERE {self._column_id} = (?)",(id,))
        self.conn.commit()
        return self.cursor.rowcount # Number of affected rows

    def get_user_id_list(self):
        self.cursor.execute(f"SELECT {self._column_id} FROM {self._table_name}")
        result = self.cursor.fetchall()
        return [row[0] for row in result] # Send list of user IDs

    def get_user_vectors(self):
        self.cursor.execute(f"SELECT {self._column_data} FROM {self._table_name}")
        result = self.cursor.fetchall()
        return [row[0] for row in result]

    def get_table(self):
        self.cursor.execute(f"SELECT * FROM {self._table_name}")
        result = self.cursor.fetchall()
        return result


    def reset_database(self):
        # Close database connexions
        self.conn.commit()
        self.conn.close()
        # Delete database file
        os.remove(self.path)
        # Restart database creation
        self.__init__(self.path)
        return


    def process_dataset(self, user_to_images_b64: dict):
        """Reset the DB and insert one row per user with their images encoded in base64."""
        self.reset_database()
        for _user_id, images_b64 in user_to_images_b64.items():
            images_b64 = np.array(images_b64)
            self.add_user(images_b64)


    def load_anonymized_dataset_from_folder(self, directory: str = None):
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









