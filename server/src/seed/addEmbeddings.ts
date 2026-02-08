import { addUserEmbedding } from "../database.ts";
import fs from "node:fs";
import path from "node:path";
import { dpSvdEmbeddingFromMatrix } from "../lib/dpSvd.ts";
import sharp from "sharp";

const TARGET_SIZE = 100;
const DP_SVD_OPTIONS = {
  epsilon: 0.4,
  nSingularValues: 15,
  imageSize: [TARGET_SIZE, TARGET_SIZE] as [number, number],
  blockSize: 25,
};

const collectImages = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectImages(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const grayscaleBufferToMatrix = (
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
) => {
  const matrix: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      row.push(data[idx] ?? 0);
    }
    matrix.push(row);
  }
  return matrix;
};

const parseSubjectId = (filePath: string) => {
  const name = path.basename(filePath);
  const match = name.match(/subject(\d+)/i);
  if (!match?.[1]) {
    return null;
  }
  const numeric = Number(match[1]);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return String(numeric);
};

const addEmbeddings = async () => {
  const datasetDir = path.resolve(process.cwd(), "dataset-yalefaces");
  const images = collectImages(datasetDir);
  if (!images.length) {
    console.warn(`No images found in ${datasetDir}`);
    return;
  }

  for (const imagePath of images) {
    const subjectId = parseSubjectId(imagePath);
    if (!subjectId) {
      continue;
    }
    const uId = `u10${subjectId}`;
    console.log(uId);

    try {
      const { data, info } = await sharp(imagePath)
        .resize(TARGET_SIZE, TARGET_SIZE, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const matrix = grayscaleBufferToMatrix(
        data,
        info.width,
        info.height,
        info.channels,
      );
      const embedding = dpSvdEmbeddingFromMatrix(matrix, DP_SVD_OPTIONS);
      addUserEmbedding(uId, JSON.stringify(embedding));
    } catch (error) {
      console.error(`Failed to process ${imagePath}`, error);
    }
  }
};

addEmbeddings();
