import { PCA } from 'ml-pca';
import { Matrix } from 'ml-matrix';

export default function cropImage(
  canvas: HTMLCanvasElement,
  videoRect: DOMRect,
  ellipseRect: DOMRect,
  TARGET_SIZE: number
) {
  const scaleX = canvas.width / videoRect.width;
  const scaleY = canvas.height / videoRect.height;

  const rawCropX = (ellipseRect.left - videoRect.left) * scaleX;
  const rawCropY = (ellipseRect.top - videoRect.top) * scaleY;
  const rawCropWidth = ellipseRect.width * scaleX;
  const rawCropHeight = ellipseRect.height * scaleY;

  const cropX = Math.max(0, rawCropX);
  const cropY = Math.max(0, rawCropY);
  const cropWidth = Math.min(canvas.width - cropX, rawCropWidth);
  const cropHeight = Math.min(canvas.height - cropY, rawCropHeight);

  if (cropWidth <= 0 || cropHeight <= 0) {
    return null;
  }

  const croppedCanvas = document.createElement('canvas');
  const targetWidth = TARGET_SIZE;
  const targetHeight = TARGET_SIZE;
  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;
  const croppedContext = croppedCanvas.getContext('2d');

  if (!croppedContext) {
    return null;
  }

  croppedContext.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );
  const imageData = croppedContext.getImageData(
    0,
    0,
    targetWidth,
    targetHeight
  );
  const imageUrl = croppedCanvas.toDataURL('image/png');
  return { imageData, imageUrl };
}

export function grayscaleImage(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  const imageArray = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixelData = imageArray.data;
  for (let i = 0; i < pixelData.length; i += 4) {
    const luminance =
      0.2126 * pixelData[i] +
      0.7152 * pixelData[i + 1] +
      0.0722 * pixelData[i + 2];
    pixelData[i] = luminance;
    pixelData[i + 1] = luminance;
    pixelData[i + 2] = luminance;
  }
  ctx.putImageData(imageArray, 0, 0);
}

export function imageToMatrix(imageData: Uint8ClampedArray, size: number) {
  const matrix: number[][] = [];
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      row.push(imageData[i * size + j]);
    }
    matrix.push(row);
  }
  return matrix;
}

export function pcaEmbedding(
  imageData: Uint8ClampedArray,
  n_components: number
) {
  const matrix = imageToMatrix(imageData, 100);
  const X = new Matrix(matrix);
  const pca = new PCA(X);

  const reduced = pca.predict(X, { nComponents: n_components });
  console.log('reduced', reduced);
  return reduced;
}
