import {
  getUserById,
  getUserPrivateDataByUserId,
  addUserPrivateData as addUserPrivateDataDb,
  updateUserPrivateData as updateUserPrivateDataDb,
  getUserForAuthentication,
  getUserByUsername,
  getUserByEmailHash,
  addUser,
  addUserToShop,
  updateUser,
  addUserActivity,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import type { User, UserPrivateData } from "../types/user.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../tools/trpc.ts";
import type { ChallengeSession } from "./passwordless.ts";
import { completePrimaryAuthentication } from "./mfa.ts";
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

type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

type ConfirmPasswordInput = {
  password: string;
};

type UpdateMfaPreferenceInput = {
  enabled: boolean;
};

export function generateJwt(userId: string) {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "1h" });
}

export async function registerUser(input: RegistrationInput) {
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
    MFAEnabled: false,
  });
  addUserActivity(userId, "User registered, waiting for email confirmation");

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
  addUserActivity(userId, "Privacy preset applied: pl4");

  return {
    message: "Registration successful",
    jwt: generateJwt(userId),
  };
}

export async function authenticateUser(
  input: AuthenticationInput,
  session?: ChallengeSession,
) {
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

  const resolvedUser =
    !user.hpkePublicKeyB64 && hpkePublicKeyB64
      ? { ...user, hpkePublicKeyB64 }
      : user;

  addUserActivity(user.userId, "User authenticated (password-based login)");

  return completePrimaryAuthentication(resolvedUser, "password", session);
}

export function addUserPrivateData(
  userId: string,
  privateData: UserPrivateData,
) {
  const existing = getUserById(userId);
  if (!existing) {
    throw new HttpError(404, "User not found");
  }
  const existingPrivateData = getUserPrivateDataByUserId(userId);
  if (existingPrivateData) {
    throw new HttpError(
      409,
      "User private data already exists. Use updateUserPrivateData.",
    );
  }
  console.log("privateData: ", privateData);
  addUserPrivateDataDb(userId, privateData);
  return {
    message: "User private data added successfully",
  };
}

export function updateUserPrivateData(
  userId: string,
  privateData: UserPrivateData,
) {
  const existing = getUserById(userId);
  if (!existing) {
    throw new HttpError(404, "User not found");
  }
  const existingPrivateData = getUserPrivateDataByUserId(userId);
  if (!existingPrivateData) {
    throw new HttpError(
      404,
      "User private data not found. Use addUserPrivateData first.",
    );
  }
  updateUserPrivateDataDb(userId, privateData);
  return {
    message: "User private data updated successfully",
  };
}

export async function changeUserPassword(
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
  addUserActivity(existingUser.userId, "Password changed");
  return { message: "Password changed successfully" };
}

export async function confirmUserPassword(
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

export function updateMfaPreference(
  input: UpdateMfaPreferenceInput,
  user: User,
) {
  if (!user.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const existingUser = getUserById(user.userId);

  if (!existingUser) {
    throw new HttpError(400, "User not found");
  }

  updateUser(existingUser.userId, { MFAEnabled: input.enabled });
  addUserActivity(
    existingUser.userId,
    `MFA ${input.enabled ? "enabled" : "disabled"}`,
  );

  return {
    MFAEnabled: input.enabled,
    message: `MFA ${input.enabled ? "enabled" : "disabled"} successfully`,
  };
}
