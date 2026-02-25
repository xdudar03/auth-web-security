import {
  addCustomer,
  addCustomerEmbedding,
  addUser,
  addUserEmbedding,
} from "../database.ts";
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

const USER_IDS = [
  "u101",
  "u102",
  "u103",
  "u104",
  "u105",
  "u106",
  "u107",
  "u108",
] as const;
const CUSTOMER_IDS = [
  "c109",
  "c110",
  "c111",
  "c112",
  "c113",
  "c114",
  "c115",
] as const;

const USER_ID_SET = new Set<string>(USER_IDS);
const CUSTOMER_ID_SET = new Set<string>(CUSTOMER_IDS);

addUser({
  userId: "u106",
  username: "u106",
  password: "u106",
  email: "u106@example.com",
  isBiometric: false,
  roleId: 2,
  privacyPreset: "pl4",
});
addUser({
  userId: "u107",
  username: "u107",
  password: "u107",
  email: "u107@example.com",
  isBiometric: false,
  roleId: 2,
  privacyPreset: "pl4",
});
addUser({
  userId: "u108",
  username: "u108",
  password: "u108",
  email: "u108@example.com",
  isBiometric: false,
  roleId: 2,
  privacyPreset: "pl4",
});
addCustomer({
  customerId: "c109",
  isBiometric: true,
});
addCustomer({
  customerId: "c110",
  isBiometric: true,
});
addCustomer({
  customerId: "c111",
  isBiometric: true,
});
addCustomer({
  customerId: "c112",
  isBiometric: true,
});
addCustomer({
  customerId: "c113",
  isBiometric: true,
});
addCustomer({
  customerId: "c114",
  isBiometric: true,
});
addCustomer({
  customerId: "c115",
  isBiometric: true,
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
  const embeddingsByCustomer = new Map<string, number[][]>();
  for (const imagePath of images) {
    const subjectId = parseSubjectId(imagePath);
    if (!subjectId) {
      continue;
    }
    const numericSubjectId = Number(subjectId);
    if (Number.isNaN(numericSubjectId)) {
      continue;
    }
    // subject01 -> u101/c101, subject10 -> u110/c110, subject15 -> u115/c115
    const uId = `u${100 + numericSubjectId}`;
    const cId = `c${100 + numericSubjectId}`;
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
      if (USER_ID_SET.has(uId)) {
        const existing = embeddingsByUser.get(uId) ?? [];
        existing.push(embedding);
        embeddingsByUser.set(uId, existing);
      }

      if (CUSTOMER_ID_SET.has(cId)) {
        const existingCustomer = embeddingsByCustomer.get(cId) ?? [];
        existingCustomer.push(embedding);
        embeddingsByCustomer.set(cId, existingCustomer);
      }
    } catch (error) {
      console.error(`Failed to process ${imagePath}`, error);
    }
  }

  for (const [userId, embeddings] of embeddingsByUser.entries()) {
    if (!embeddings.length) {
      continue;
    }

    addUserEmbedding(userId, JSON.stringify(embeddings));
  }

  for (const [customerId, embeddings] of embeddingsByCustomer.entries()) {
    if (!embeddings.length) {
      continue;
    }

    addCustomerEmbedding(customerId, JSON.stringify(embeddings));
  }
};

addEmbeddings();
