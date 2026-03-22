import {
  addUser,
  addUserToShop,
  updateUser,
  addUserEmbedding,
  getUserById,
  getUserByUsername,
  getUserByEmailHash,
  getUserWithRoleQuery,
  getUserForAuthentication,
  addUserPrivateData,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../tools/trpc.ts";
import bcrypt from "bcryptjs";
import type { User, UserPrivateData } from "../types/user.ts";
import { addNewEmbedding } from "./model.ts";
import { applyPrivacyPreset } from "./privacy.ts";

type RegistrationInput = {
  userId: string;
  privateData: UserPrivateData;
  hpkePublicKeyB64: string;
  recoverySaltB64: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIv: string;
  username: string;
  emailHash: string;
  password: string;
  roleId: number | string;
  shopIds: number[];
};

type AuthenticationInput = {
  username: string;
  password: string;
  hpkePublicKeyB64?: string | undefined;
};

type ChangeEmbeddingInput = {
  embedding: string;
};

type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

type ConfirmPasswordInput = {
  password: string;
};

export function generateJwt(userId: string) {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "1h" });
}

export async function registerBiometricUser(input: RegistrationInput) {
  const {
    userId,
    privateData,
    hpkePublicKeyB64,
    recoverySaltB64,
    encryptedPrivateKey,
    encryptedPrivateKeyIv,
    username,
    emailHash,
    password,
    roleId,
    shopIds,
  } = input;
  const existingUserByUsername = getUserByUsername(username);

  if (existingUserByUsername) {
    throw new HttpError(400, "User already exists");
  }

  const existingUserByEmail = getUserByEmailHash(emailHash);
  if (existingUserByEmail) {
    throw new HttpError(400, "User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  addUser({
    userId,
    hpkePublicKeyB64,
    recoverySaltB64,
    encryptedPrivateKey,
    encryptedPrivateKeyIv,
    emailHash,
    username,
    password: hashedPassword,
    roleId: typeof roleId === "string" ? Number(roleId) : roleId,
    isBiometric: false,
  });

  addUserPrivateData(userId, privateData);

  // const user = getUserWithRoleQuery.get(userId);
  if (shopIds.length > 0) {
    for (const shopId of shopIds) {
      addUserToShop(userId, shopId);
    }
  } else {
    throw new HttpError(400, "No shops provided");
  }

  applyPrivacyPreset(userId, "pl4");

  return {
    message: "Registration successful",
    jwt: generateJwt(userId),
  };
}

export async function authenticateBiometricUser(input: AuthenticationInput) {
  const { username, password, hpkePublicKeyB64 } = input;

  const user = getUserForAuthentication(username);

  if (!user) {
    throw new HttpError(400, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password as string,
  );
  if (!isPasswordValid) {
    throw new HttpError(400, "Invalid password");
  }

  if (!user.hpkePublicKeyB64 && hpkePublicKeyB64) {
    updateUser(user.userId as string, { hpkePublicKeyB64 });
  }

  const jwt = generateJwt(user.userId as string);
  return {
    jwt,
    hpkePublicKeyB64: user.hpkePublicKeyB64 ?? null,
    recoverySaltB64: user.recoverySaltB64 ?? null,
    encryptedPrivateKey: user.encryptedPrivateKey ?? null,
    encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? null,
  };
}

export async function changeBiometricEmbedding(
  input: ChangeEmbeddingInput,
  user: User,
) {
  const { embedding } = input;
  const serializedEmbedding =
    typeof embedding === "string" ? embedding : JSON.stringify(embedding);

  if (!user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const existingUser = getUserById(user.userId);
  if (!existingUser) {
    throw new HttpError(400, "User not found");
  }

  const response = await addNewEmbedding(
    existingUser.userId,
    serializedEmbedding,
  );

  updateUser(existingUser.userId, { isBiometric: true });
  // addNewEmbedding throws on non-2xx; response message text can vary.
  if (!response?.message) {
    throw new HttpError(500, "Failed to add embedding");
  }

  return {
    message: "Biometric changed successfully",
  };
}

export async function changeBiometricPassword(
  input: ChangePasswordInput,
  user: User,
) {
  const { oldPassword, newPassword } = input;

  if (!user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const existingUser = getUserById(user.userId);

  if (!existingUser) {
    throw new HttpError(400, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    oldPassword,
    existingUser.password,
  );

  if (!isPasswordValid) {
    throw new HttpError(400, "Invalid password");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  updateUser(existingUser.userId, { password: hashedPassword });

  return { message: "Password changed successfully" };
}

export async function confirmBiometricPassword(
  input: ConfirmPasswordInput,
  user: User,
) {
  const { password } = input;

  if (!user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const existingUser = getUserById(user.userId);

  if (!existingUser) {
    throw new HttpError(400, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.password);
  if (!isPasswordValid) {
    throw new HttpError(400, "Invalid password");
  }

  return { message: "Password confirmed successfully" };
}
