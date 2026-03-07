import { Matrix } from "ml-matrix";

const matrixCache = new Map<string, Matrix>();

export const l2NormalizeVector = (vector: number[]) => {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    const value = vector[i];
    if (value !== undefined) {
      sumSquares += value * value;
    }
  }

  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm <= 1e-12) {
    return vector.slice();
  }

  return vector.map((value) => value / norm);
};

const fnv1a32 = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const getProjectionMatrix = (
  sourceDimension: number,
  targetDimension: number,
  version = "rp-v1",
) => {
  if (sourceDimension <= 0 || targetDimension <= 0) {
    throw new Error("Projection dimensions must be positive");
  }

  const cacheKey = `${version}:${sourceDimension}:${targetDimension}`;
  const cachedMatrix = matrixCache.get(cacheKey);
  if (cachedMatrix) {
    return cachedMatrix;
  }

  const seed = fnv1a32(cacheKey);
  const random = mulberry32(seed);
  const scale = 1 / Math.sqrt(targetDimension);
  const values = new Array<number>(targetDimension * sourceDimension);

  for (let index = 0; index < values.length; index += 1) {
    values[index] = random() < 0.5 ? -scale : scale;
  }

  const matrix = Matrix.from1DArray(targetDimension, sourceDimension, values);
  matrixCache.set(cacheKey, matrix);
  return matrix;
};
