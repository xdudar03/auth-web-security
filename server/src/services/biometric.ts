import {
  addUser,
  addUserToShop,
  getAllUsers,
  updateUser,
  addUserEmbedding,
  getUserById,
  getUserWithRoleQuery,
  getUserForAuthentication,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../tools/trpc.ts";
import bcrypt from "bcryptjs";
import type { User } from "../types/user.ts";
import { addNewEmbedding } from "./model.ts";
import { applyPrivacyPreset } from "./privacy.ts";

type RegistrationInput = {
  userId: string;
  username: string;
  email: string;
  password: string;
  roleId: number | string;
  shopIds: number[];
};

type AuthenticationInput = {
  username: string;
  password: string;
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
  console.log("registerBiometricUser input: ", input);
  const { userId, username, email, password, roleId, shopIds } = input;
  console.log("shopIds: ", shopIds.length);
  const usersFromDB = getAllUsers();

  if (usersFromDB.find((user: User) => user.username === username)) {
    throw new HttpError(400, "User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  addUser({
    userId,
    username,
    email,
    password: hashedPassword,
    roleId: typeof roleId === "string" ? Number(roleId) : roleId,
    isBiometric: false,
  });

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
  const { username, password } = input;
  console.log("username: ", username);
  console.log("password: ", password);

  const user = getUserForAuthentication(username, username, username);

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
  const jwt = generateJwt(user.userId as string);
  console.log("jwt in authenticateBiometricUser: ", jwt);
  return { jwt };
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
  console.log("response from addNewEmbedding: ", response);

  updateUser(existingUser.userId, { isBiometric: true });
  if (response.message !== "Embedding added; retraining started") {
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
  console.log("user jwt: ", user);

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
