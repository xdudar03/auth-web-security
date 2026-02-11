import { addUser, addUserEmbedding, getUserById } from "../database.ts";
import fs from "node:fs";
import path from "node:path";
import { dpSvdEmbeddingFromMatrix } from "../lib/dpSvd.ts";
import sharp from "sharp";
import { initialModelTraining } from "../services/model.ts";

const TARGET_SIZE = 100;
const DP_SVD_OPTIONS = {
  epsilon: 0.4,
  nSingularValues: 15,
  imageSize: [TARGET_SIZE, TARGET_SIZE] as [number, number],
  blockSize: 25,
};

addUser({
  userId: "u106",
  username: "u106",
  password: "u106",
  email: "u106@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u107",
  username: "u107",
  password: "u107",
  email: "u107@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u108",
  username: "u108",
  password: "u108",
  email: "u108@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u109",
  username: "u109",
  password: "u109",
  email: "u109@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u110",
  username: "u110",
  password: "u110",
  email: "u110@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u111",
  username: "u111",
  password: "u111",
  email: "u111@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u112",
  username: "u112",
  password: "u112",
  email: "u112@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u113",
  username: "u113",
  password: "u113",
  email: "u113@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u114",
  username: "u114",
  password: "u114",
  email: "u114@example.com",
  isBiometric: false,
  roleId: 2,
});
addUser({
  userId: "u115",
  username: "u115",
  password: "u115",
  email: "u115@example.com",
  isBiometric: false,
  roleId: 2,
});

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
  const datasetDir = path.resolve(process.cwd(), "yalefaces");
  const images = collectImages(datasetDir);
  if (!images.length) {
    console.warn(`No images found in ${datasetDir}`);
    return;
  }

  const embeddingsByUser = new Map<string, number[][]>();

  for (const imagePath of images) {
    const subjectId = parseSubjectId(imagePath);
    if (!subjectId) {
      continue;
    }
    const numericSubjectId = Number(subjectId);
    if (Number.isNaN(numericSubjectId)) {
      continue;
    }
    // subject01 -> u101, subject10 -> u110, subject15 -> u115
    const uId = `u${100 + numericSubjectId}`;

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
      const existing = embeddingsByUser.get(uId) ?? [];
      existing.push(embedding);
      embeddingsByUser.set(uId, existing);
    } catch (error) {
      console.error(`Failed to process ${imagePath}`, error);
    }
  }

  for (const [userId, embeddings] of embeddingsByUser.entries()) {
    if (!embeddings.length) {
      continue;
    }
    if (!getUserById(userId)) {
      console.warn(`Skipping embeddings for unknown userId: ${userId}`);
      continue;
    }
    addUserEmbedding(userId, JSON.stringify(embeddings));
  }
};

addEmbeddings();
