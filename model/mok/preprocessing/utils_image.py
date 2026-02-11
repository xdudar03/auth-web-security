import io
import base64
import numpy as np
import PIL
from PIL import Image

def pillow_image_to_bytes(element: PIL.Image.Image|list[PIL.Image.Image]) -> str|list[str]:
    """Converts a PIL image or a list of PIL image to a bytes string image(s)."""
    if element is None:
        raise ValueError("no element for pillow_image_to_bytes()")
    def convert(image):
        if not isinstance(image, Image.Image):
            raise ValueError("'image' must be a valid PIL Image object.")
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG')
        return base64.b64encode(buffer.getvalue()).decode()
    if isinstance(element, list):
        return [convert(image) for image in element]
    else:
        return convert(element)


def numpy_image_to_pillow(element: np.ndarray | list[np.ndarray], resized_size: (int, int) = None,
                          list_mode: bool = False) -> Image.Image | list[Image.Image]:
    """Converts a NumPy array or a list of NumPy array to a PIL image(s)."""
    if element is None:
        raise ValueError("no element for numpy_image_to_pillow()")

    def convert(image):
        if image is None or not isinstance(image, np.ndarray):
            raise ValueError("'image' must be a valid NumPy array.")
        elif image.ndim == 1:
            if resized_size is None:
                raise ValueError("'resized_size' must be provided because the image is one-dimensional.")
            image = image.reshape(resized_size)

        # Ensure values are in the correct range
        if image.dtype != np.uint8:
            # If float values are not already in [0,1], normalize per-image
            img_min = float(np.min(image))
            img_max = float(np.max(image))
            if img_max > 1.0 or img_min < 0.0:
                denom = (img_max - img_min) if (img_max - img_min) != 0 else 1.0
                image = (image - img_min) / denom
            image = (np.clip(image, 0.0, 1.0) * 255.0).astype(np.uint8)

        # Handle color channels
        if image.ndim == 2:
            return Image.fromarray(image, mode='L')  # Grayscale image
        elif image.ndim == 3 and image.shape[2] == 3:
            return Image.fromarray(image, mode='RGB')  # Color image
        else:
            raise ValueError("Unsupported image shape: {}".format(image.shape))

    if isinstance(element, list) or list_mode:
        return [convert(image) for image in element]
    else:
        return convert(element)