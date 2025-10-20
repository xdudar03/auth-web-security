// lib/pcaEigenfaces.ts
import { PCA } from 'ml-pca';
import { Matrix } from 'ml-matrix';

export interface PCAResult {
  eigenfaces: number[][];
  meanFace: number[];
  components: number[][];
  explainedVariance: number[];
}

/**
 * PCA Eigenfaces generator for browser
 * Works similarly to sklearn.decomposition.PCA
 */
export class PCAEigenfaces {
  private images: number[][] = [];
  private imageShape: [number, number];
  private nComponents: number;
  private pca: any | null = null;

  constructor(imageShape: [number, number], nComponents = 20) {
    this.imageShape = imageShape;
    this.nComponents = nComponents;
  }

  /** Adds flattened grayscale images to the PCA dataset */
  addImage(flattenedImage: number[]) {
    if (flattenedImage.length !== this.imageShape[0] * this.imageShape[1]) {
      throw new Error('Image shape mismatch');
    }
    this.images.push(flattenedImage);
  }

  /** Run PCA to generate eigenfaces and mean face */
  generate(): PCAResult {
    if (this.images.length < 2) {
      throw new Error(
        'At least two images are required to generate eigenfaces.'
      );
    }

    const X = new Matrix(this.images);
    this.pca = new PCA(X);

    const components = this.pca.getLoadings().to2DArray(); // pca object
    const mean = this.pca.means; // shape [n_features]

    const eigenfaces = components
      .slice(0, this.nComponents)
      .map((comp: number[]) =>
        comp.slice(0, this.imageShape[0] * this.imageShape[1])
      );

    return {
      eigenfaces,
      meanFace: mean,
      components,
      explainedVariance: this.pca.getExplainedVariance(),
    };
  }

  /** Project a new image into the PCA space */
  project(image: number[]): number[] {
    if (!this.pca) throw new Error('PCA not generated yet');
    const projection = this.pca.predict([image]);

    if (!projection) {
      return [];
    }

    if (typeof projection.to2DArray === 'function') {
      const twoD = projection.to2DArray();
      return twoD?.[0] ? [...twoD[0]] : [];
    }

    if (Array.isArray(projection)) {
      if (Array.isArray(projection[0])) {
        return [...projection[0]];
      }
      return [...projection];
    }

    if ('data' in projection && Array.isArray((projection as any).data)) {
      const matrixLike = projection as { data: number[]; columns?: number };
      if (!matrixLike.data.length) {
        return [];
      }
      if (matrixLike.columns) {
        return matrixLike.data.slice(0, matrixLike.columns);
      }
      return [...matrixLike.data];
    }

    return [];
  }

  /** Reconstruct an image from PCA projection */
  reconstruct(embedding: number[]): number[] {
    if (!this.pca) throw new Error('PCA not generated yet');
    const reconstructed = this.pca.invert([embedding]);

    if (!reconstructed) {
      return [];
    }

    if (typeof reconstructed.to2DArray === 'function') {
      const twoD = reconstructed.to2DArray();
      return twoD?.[0] ? [...twoD[0]] : [];
    }

    if (Array.isArray(reconstructed)) {
      if (Array.isArray(reconstructed[0])) {
        return [...reconstructed[0]];
      }
      return [...reconstructed];
    }

    if ('data' in reconstructed && Array.isArray((reconstructed as any).data)) {
      const matrixLike = reconstructed as { data: number[] };
      return [...matrixLike.data];
    }

    return [];
  }
}
