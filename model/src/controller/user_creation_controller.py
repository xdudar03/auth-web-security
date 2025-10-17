import os
import pickle

from werkzeug.datastructures import FileStorage
import numpy as np

import src.modules.anony_process_pipeline as pipeline
from src.modules.utils_image import pillow_image_to_bytes, filestorage_image_to_numpy, numpy_image_to_pillow
from src.controller.database_controller import DatabaseController

class UserCreationController:

    pkl_path = os.path.join("data", "temp_gui_controller.pkl")
    reconstructed_dir = os.path.join("data", "reconstructed_pipeline")

    def __init__(self, images: list[FileStorage], new_pkl_path: str=None):
        print("Initializing UserCreationController")
        self.images = images
        if not images:
            raise Exception('No images')
        if not all(isinstance(image, FileStorage) for image in images):
            raise Exception('All images must be of type FileStorage')
        # Images Attributs
        self.image_size: (int, int) = (100,) * 2
        self.images_source: list[np.ndarray] = filestorage_image_to_numpy(images)
        # Try close FileStorage link
        self.step1 = self.step2 = self.step3 = self.step4 = self.step5 = None
        self.next_step = 1
        if new_pkl_path: UserCreationController.pkl_path = new_pkl_path

    #-----------------------------------------------------------------------------------#
    #-----------------------------------------------------------------------------------#
    #-------------------------# DATABASE MANAGEMENT WORKFLOW #--------------------------#
    #-----------------------------------------------------------------------------------#
    #-----------------------------------------------------------------------------------#
    @classmethod
    def get_user_list(cls):
        return DatabaseController().get_user_id_list()

    @classmethod
    def get_user_data(cls, user_id: int):
        return DatabaseController().get_user(user_id)

    @classmethod
    def delete_user(cls, user_id: int):
        return DatabaseController().delete_user(user_id)

    #-----------------------------------------------------------------------------------#
    #-----------------------------------------------------------------------------------#
    #-----------------------------# CREATE USER WORKFLOW #------------------------------#
    #-----------------------------------------------------------------------------------#

    def can_run_step(self, step:int):
        return 0 <= step <= self.next_step

    @classmethod
    def initialize_new_user(cls, files: list[FileStorage], image_size:(int, int)=None, img_size_unit:str="px", pkl_path=None) -> (dict, int):
        """Step 1 : Preprocessing"""
        # Check input images format
        if not files: return {'error': 'No files uploaded'}, 400
        if not all(isinstance(file, FileStorage) for file in files): return {'error': 'Uploaded files are invalid'}, 400
        if len(files) > 25: return {'error': 'Too many images'}, 400
        # TODO: img_size_unit % to integrate
        try: image_size = (int(image_size[0]), int(image_size[1]))
        except: return {'error': 'image_size must be a tuple of int with size equal 2'}, 400
        # Init GUI Controller
        ctrl = UserCreationController(files, new_pkl_path=pkl_path)
        ##### STEP 1 : Preprocessing #####
        try: ctrl.step1, ctrl.image_size = pipeline.run_preprocessing(filestorage_list=files, image_size_override=image_size)
        except Exception as e:  return {'error': str(e)}, 400
        # Init Pickle file to save GUI Controller
        ctrl.next_step = 3
        ctrl.save_into_pickle()
        # Return validation of the process
        return {}, 200

    @classmethod
    def apply_k_same_pixel(cls, k_same_value:int=4):
        return {'error': 'K-Same pixelation step has been removed from the pipeline.'}, 400

    @classmethod
    def generate_pca_components(cls, n_components: int=None):
        """Step 3 : PEEP Eigenface"""
        # Retrieve GUI Controller
        ctrl = UserCreationController.load_pickle_file()
        if not ctrl: return {'error': 'Please run the fist step before this one'}, 400
        if not ctrl.can_run_step(3): return {'error': 'Step not ready to run'}, 400
        if not ctrl.step1:
            return {'error': 'No preprocessed images available. Please complete step 1.'}, 400
        # Gather flattened images directly from preprocessing output
        first_user = next(iter(ctrl.step1))
        images = []
        for item in ctrl.step1[first_user]:
            flattened = item.get('flattened_image')
            if isinstance(flattened, np.ndarray) and flattened.ndim == 1:
                images.append(flattened)
        if len(images) < 2:
            return {'error': 'Not enough preprocessed images to run PCA.'}, 400
        images = np.array(images, dtype=np.float32)
        images = np.array(images, dtype=np.float32)
        n_samples, n_features = images.shape
        # TODO: change with anony_test_analysis.py to generate real optimal number + graph et mettre cette partie dans une fonction à part dans le back
        n_components_ratio = 0.8
        n_components_optimal = min(max(1, int(n_components_ratio * n_samples)), n_features)
        print(f"n_components_optimal: {n_components_optimal}")
        if n_components is None:
            n_components = n_components_optimal
        else:
            try: n_components = int(n_components)
            except: return {'error': 'n_components must be an Integer'}, 400
        ##### Step 3 : PEEP Eigenface #####
        try:  ctrl.step3 = pipeline.run_eigenface(images, n_components)
        except Exception as e:  return {'error': str(e)}, 400
        # Update Pickle GUI Controller
        ctrl.next_step = 4
        ctrl.save_into_pickle()
        # Return validation of the process
        images = ctrl.step3[0].components_
        images = pillow_image_to_bytes(numpy_image_to_pillow(images, ctrl.image_size, True))
        return {'images':images}, 200

    @classmethod
    def apply_differential_privacy(cls, epsilon: float):
        """Step 4 & 5 : Differential privacy & Reconstruction"""
        # Retrieve GUI Controller
        ctrl = UserCreationController.load_pickle_file()
        if not ctrl: return {'error': 'Please run the fist step before this one'}, 400
        if not ctrl.can_run_step(4):  return {'error': 'Step not ready to run'}, 400
        # Check input images format
        if epsilon is None: return {'error': 'epsilon parameter is missing'}, 400
        try: epsilon = float(epsilon)
        except: return {'error': 'epsilon must be a float'}, 400
        try:
            ##### Step 4 : Differential privacy #####
            pca, mean_face, projection = ctrl.step3
            ctrl.step4 = pipeline.run_add_noise(projection, epsilon)
            ##### Step 5 : Reconstruction #####
            ctrl.step5 = pipeline.run_reconstruction(pca, ctrl.step4, ctrl.image_size)
        except Exception as e:
            return {'error': str(e)}, 400
        # Update Pickle GUI Controller
        ctrl.next_step = 5
        ctrl.save_into_pickle()
        # Return validation of the process
        return {'images': ctrl.step5}, 200

    @classmethod
    def save_user_in_db(cls, db_path=None):
        # Retrieve GUI Controller
        ctrl = UserCreationController.load_pickle_file()
        if not ctrl: return {'error': 'Please run the fist step before this one'}, 400
        if not ctrl.can_run_step(4):  return {'error': 'Step not ready to run'}, 400
        # Save user
        try:
            db = DatabaseController() if db_path is None else DatabaseController(db_path)
            user_id = db.add_user(np.array(ctrl.step5))
        except Exception as e:
            return {'error': str(e)}, 400
        # Destroy Pickle GUI Controller
        UserCreationController.delete_pickle_file()
        # Return validation of the process
        return {'user_id': user_id}, 200


    #---------------------------------------------------------------------------------#
    #-----------------------------# PICKLE SYSTEM PART #------------------------------#
    #---------------------------------------------------------------------------------#

    def save_into_pickle(self):
        # Create pickle file
        os.makedirs(os.path.dirname(self.pkl_path), exist_ok=True)
        with open(self.pkl_path, 'wb') as file:
            # Save data
            pickle.dump(self.to_dict(), file)

    @classmethod
    def load_pickle_file(cls):
        try:
            with open(cls.pkl_path, 'rb') as file:
                data = pickle.load(file)
            # Create new instance without call __init__
            instance = cls.__new__(cls)
            instance.__init__ = lambda *a, **kw: None
            for key, value in data.items():
                setattr(instance, key, value)
            return instance
        except FileNotFoundError:
            return None
        except Exception as e:
            raise e

    @classmethod
    def delete_pickle_file(cls):
        if os.path.exists(UserCreationController.pkl_path):
            os.remove(UserCreationController.pkl_path)

    def to_dict(self):
        return {
            "pkl_path": self.pkl_path,
            "reconstructed_dir": self.reconstructed_dir,
            "image_size": self.image_size,
            "images_source": self.images_source,
            "step1": self.step1,"step2": self.step2,"step3": self.step3,"step4": self.step4,"step5": self.step5,
            "next_step": self.next_step,
        }

