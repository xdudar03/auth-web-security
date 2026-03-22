import {
  addCustomer,
  addCustomerEmbedding,
  addUser,
  addUserPrivateData,
  addUserEmbedding,
  addCustomerToShop,
  updateUser,
} from "../database.ts";
import fs from "node:fs";
import path from "node:path";
import { dpSvdEmbeddingFromMatrix } from "../lib/dpSvd.ts";
import sharp from "sharp";
import { buildEncryptedSeedUser } from "./encryption.ts";
import { applyPrivacyPreset } from "../services/privacy.ts";
import { getProjectionMatrix, l2NormalizeVector } from "./randomProjection.ts";
import { Matrix } from "ml-matrix";

const RP_TARGET_DIMENSION = 1024;
const RP_VERSION = "rp-v1";

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

const EMBEDDING_USERS = [
  {
    userId: "u106",
    username: "u106",
    password: "u106",
    email: "u106@example.com",
  },
  {
    userId: "u107",
    username: "u107",
    password: "u107",
    email: "u107@example.com",
  },
  {
    userId: "u108",
    username: "u108",
    password: "u108",
    email: "u108@example.com",
  },
] as const;

const EMBEDDING_CUSTOMERS = [
  "c109",
  "c110",
  "c111",
  "c112",
  "c113",
  "c114",
  "c115",
] as const;

async function seedEmbeddingUsersAndCustomers() {
  for (const user of EMBEDDING_USERS) {
    const encryptedSeedUser = await buildEncryptedSeedUser({
      userId: user.userId,
      username: user.username,
      email: user.email,
      password: user.password,
      recoveryPassphrase: user.password,
      roleId: 2,
      privacyPreset: "pl4",
      privateProfile: {
        username: user.username,
        email: user.email,
        firstName: user.username,
        lastName: user.username,
        phoneNumber: "",
        dateOfBirth: "",
        gender: "",
        country: "",
        city: "",
        address: "",
        zip: "",
        spendings: "",
        shoppingHistory: "[]",
        shops: [],
      },
      anonymizedPrivateProfile: {
        username: "hidden-user",
        email: "u***@example.com",
        firstName: "anonymous",
        lastName: "anonymous",
        phoneNumber: "***",
        dateOfBirth: "",
        gender: "other",
        country: "",
        city: "",
        address: "",
        zip: "***",
        spendings: "***",
        shoppingHistory: "[]",
        shops: [],
      },
    });

    addUser(encryptedSeedUser.user);
    addUserPrivateData(user.userId, encryptedSeedUser.privateData);
    applyPrivacyPreset(user.userId, "pl4");
  }

  for (const customerId of EMBEDDING_CUSTOMERS) {
    addCustomer({
      customerId,
      isBiometric: true,
    });
  }
}

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
    console.log(
      `Optional dataset not found at ${datasetDir}; skipping yalefaces image embedding seed.`,
    );
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

      const sourceDimension = embedding.length;
      const projectionMatrix = getProjectionMatrix(
        sourceDimension,
        RP_TARGET_DIMENSION,
        RP_VERSION,
      );
      const normalizedEmbedding = l2NormalizeVector(embedding);
      const projectedEmbedding = projectionMatrix
        .mmul(
          new Matrix(
            normalizedEmbedding.map((value: number) => [value] as [number]),
          ),
        )
        .to1DArray();
      const normalizedProjectedEmbedding = l2NormalizeVector(projectedEmbedding);

      if (USER_ID_SET.has(uId)) {
        const existing = embeddingsByUser.get(uId) ?? [];
        existing.push(normalizedProjectedEmbedding);
        embeddingsByUser.set(uId, existing);
        // set isBiometric to true
        updateUser(uId, { isBiometric: true });
      }

      if (CUSTOMER_ID_SET.has(cId)) {
        const existingCustomer = embeddingsByCustomer.get(cId) ?? [];
        existingCustomer.push(normalizedProjectedEmbedding);
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
  addCustomerToShop("c109", 1);
  addCustomerToShop("c110", 2);
  addCustomerToShop("c111", 3);
  addCustomerToShop("c112", 1);
  addCustomerToShop("c113", 2);
  addCustomerToShop("c114", 3);
  addCustomerToShop("c115", 1);
};

async function runSeedEmbeddings() {
  await seedEmbeddingUsersAndCustomers();
  await addEmbeddings();
}

runSeedEmbeddings().catch((error) => {
  console.error("Failed to seed embeddings", error);
  process.exit(1);
});
