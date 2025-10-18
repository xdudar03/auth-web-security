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
    // if (this.images.length < 2) {
    //   throw new Error(
    //     'At least two images are required to generate eigenfaces.'
    //   );
    // }

    const X = new Matrix(this.images);
    this.pca = new PCA(X);

    const components = this.pca.getLoadings().to2DArray();
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
    return this.pca.predict([image])[0];
  }

  /** Reconstruct an image from PCA projection */
  reconstruct(embedding: number[]): number[] {
    if (!this.pca) throw new Error('PCA not generated yet');
    const reconstructed = this.pca.invert([embedding]);
    return Array.from(reconstructed[0]);
  }
}
