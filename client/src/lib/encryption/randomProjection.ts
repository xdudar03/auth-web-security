import { Matrix } from 'ml-matrix';

const matrixCache = new Map<string, Matrix>();

export const l2NormalizeVector = (vector: number[]) => {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    const value = vector[i];
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm <= 1e-12) {
    return vector.slice();
  }

  return vector.map((value) => value / norm);
};

// Fowler–Noll–Vo hash function (FNV-1a)
const fnv1a32 = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    // XOR the current hash with the character code of the current character
    hash ^= value.charCodeAt(i);
    // Multiply the hash by a prime number
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// Mulberry32 pseudorandom number generator
const mulberry32 = (seed: number) => {
  // Convert the seed to an unsigned 32-bit integer
  let t = seed >>> 0;
  // Return a function that generates a random number between 0 and 1
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
  version = 'rp-v1'
) => {
  if (sourceDimension <= 0 || targetDimension <= 0) {
    throw new Error('Projection dimensions must be positive');
  }
  // creating a cache key for the matrix
  const cacheKey = `${version}:${sourceDimension}:${targetDimension}`;
  // checking if the matrix is already cached
  const cachedMatrix = matrixCache.get(cacheKey);
  // if the matrix is already cached, return it
  if (cachedMatrix) {
    return cachedMatrix;
  }
  // seeding the random number generator
  const seed = fnv1a32(cacheKey);
  // creating a random number generator
  const random = mulberry32(seed);
  // scaling the values to the target dimension
  const scale = 1 / Math.sqrt(targetDimension);
  const values = new Array<number>(targetDimension * sourceDimension);

  // generating the values for the matrix
  for (let index = 0; index < values.length; index += 1) {
    values[index] = random() < 0.5 ? -scale : scale;
  }

  // creating the matrix
  const matrix = Matrix.from1DArray(targetDimension, sourceDimension, values);
  // caching the matrix
  matrixCache.set(cacheKey, matrix);
  return matrix;
};
