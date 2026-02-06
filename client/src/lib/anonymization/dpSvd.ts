import { Matrix, SingularValueDecomposition } from 'ml-matrix';

export type DpSvdOptions = {
  epsilon: number;
  nSingularValues: number;
  imageSize: [number, number];
  blockSize?: number;
};

const normalizeValue = (value: number) => (value > 1 ? value / 255 : value);

const normalizeMatrix = (matrix: number[][]) =>
  matrix.map((row) => row.map((value) => normalizeValue(value)));

const laplaceSample = (scale: number) => {
  const u = Math.random() - 0.5;
  return scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
};

const applyDpSvdCoeffs = (
  matrix: number[][],
  nSingularValues: number,
  epsilon: number
) => {
  const svd = new SingularValueDecomposition(new Matrix(matrix), {
    autoTranspose: true,
  });
  const U = svd.leftSingularVectors;
  const singularValues = svd.diagonal;
  const k = Math.min(nSingularValues, singularValues.length);

  const scale = 1 / epsilon;
  const noisy = singularValues.slice(0, k).map((value) => {
    const withNoise = value + laplaceSample(scale);
    return Math.max(withNoise, 0);
  });

  const U_k = U.subMatrix(0, U.rows - 1, 0, k - 1);
  const coeffs = U_k.clone();
  for (let col = 0; col < k; col += 1) {
    for (let row = 0; row < coeffs.rows; row += 1) {
      coeffs.set(row, col, coeffs.get(row, col) * noisy[col]);
    }
  }

  return coeffs.to2DArray();
};

const applyDpSvdReconstruct = (
  matrix: number[][],
  nSingularValues: number,
  epsilon: number
) => {
  const svd = new SingularValueDecomposition(new Matrix(matrix), {
    autoTranspose: true,
  });
  const U = svd.leftSingularVectors;
  const V = svd.rightSingularVectors;
  const singularValues = svd.diagonal;
  const k = Math.min(nSingularValues, singularValues.length);

  const scale = 1 / epsilon;
  const noisy = singularValues.slice(0, k).map((value) => {
    const withNoise = value + laplaceSample(scale);
    return Math.max(withNoise, 0);
  });

  const U_k = U.subMatrix(0, U.rows - 1, 0, k - 1);
  const V_k = V.subMatrix(0, V.rows - 1, 0, k - 1);
  const S_noisy = Matrix.diag(noisy);

  return U_k.mmul(S_noisy).mmul(V_k.transpose()).to2DArray();
};

const padBlockEdge = (
  matrix: number[][],
  startRow: number,
  startCol: number,
  blockSize: number
) => {
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const block: number[][] = [];

  for (let i = 0; i < blockSize; i += 1) {
    const row: number[] = [];
    const srcRow = Math.min(startRow + i, height - 1);
    for (let j = 0; j < blockSize; j += 1) {
      const srcCol = Math.min(startCol + j, width - 1);
      row.push(matrix[srcRow][srcCol]);
    }
    block.push(row);
  }

  return block;
};

export const dpSvdEmbeddingFromMatrix = (
  matrix: number[][],
  options: DpSvdOptions
) => {
  const normalized = normalizeMatrix(matrix);

  if (!options.blockSize) {
    const coeffs = applyDpSvdCoeffs(
      normalized,
      options.nSingularValues,
      options.epsilon
    );
    return coeffs.flat();
  }

  const [height, width] = options.imageSize;
  const blockSize = options.blockSize;
  const embeddings: number[] = [];

  for (let i = 0; i < height; i += blockSize) {
    for (let j = 0; j < width; j += blockSize) {
      const block = padBlockEdge(normalized, i, j, blockSize);
      const coeffs = applyDpSvdCoeffs(
        block,
        options.nSingularValues,
        options.epsilon
      );
      embeddings.push(...coeffs.flat());
    }
  }

  return embeddings;
};

export const dpSvdEmbeddingFromFlattened = (
  flattened: number[],
  options: DpSvdOptions
) => {
  const [height, width] = options.imageSize;
  const matrix: number[][] = [];
  for (let i = 0; i < height; i += 1) {
    const row = flattened.slice(i * width, (i + 1) * width);
    matrix.push(row);
  }
  return dpSvdEmbeddingFromMatrix(matrix, options);
};

export const dpSvdReconstructFromMatrix = (
  matrix: number[][],
  options: DpSvdOptions
) => {
  const normalized = normalizeMatrix(matrix);
  const [height, width] = options.imageSize;

  if (!options.blockSize) {
    const recon = applyDpSvdReconstruct(
      normalized,
      options.nSingularValues,
      options.epsilon
    );
    return recon.map((row) =>
      row.map((value) => Math.min(1, Math.max(0, value)))
    );
  }

  const blockSize = options.blockSize;
  const recon: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  for (let i = 0; i < height; i += blockSize) {
    for (let j = 0; j < width; j += blockSize) {
      const block = padBlockEdge(normalized, i, j, blockSize);
      const reconBlock = applyDpSvdReconstruct(
        block,
        options.nSingularValues,
        options.epsilon
      );
      const maxRow = Math.min(blockSize, height - i);
      const maxCol = Math.min(blockSize, width - j);

      for (let bi = 0; bi < maxRow; bi += 1) {
        for (let bj = 0; bj < maxCol; bj += 1) {
          const value = reconBlock[bi]?.[bj] ?? 0;
          recon[i + bi][j + bj] = Math.min(1, Math.max(0, value));
        }
      }
    }
  }

  return recon;
};

export const dpSvdReconstructFromFlattened = (
  flattened: number[],
  options: DpSvdOptions
) => {
  const [height, width] = options.imageSize;
  const matrix: number[][] = [];
  for (let i = 0; i < height; i += 1) {
    const row = flattened.slice(i * width, (i + 1) * width);
    matrix.push(row);
  }
  return dpSvdReconstructFromMatrix(matrix, options);
};
