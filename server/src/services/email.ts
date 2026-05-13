import { sendEmail } from "../tools/mailer.ts";
import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import {
  addToken,
  addUserActivity,
  deleteToken,
  getToken,
  getUserById,
  updateUser,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import { generateJwt } from "./user.ts";
import bcrypt from "bcryptjs";
import { hashEmailForSeed } from "../lib/encryption.ts";

type EmailTokenPurpose = "reset_password" | "confirmation";

const TOKEN_EMAIL_COOLDOWN_MS = 60 * 1000;
const tokenEmailLastSentAt = new Map<string, number>();

export async function sendEmailWithToken(
  to: string,
  userId: string,
  purpose: EmailTokenPurpose,
) {
  const user = getUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  if (!user.emailHash || hashEmailForSeed(to) !== user.emailHash) {
    throw new HttpError(403, "Email address does not match this account");
  }

  const cooldownKey = `${purpose}:${userId}`;
  const lastSentAt = tokenEmailLastSentAt.get(cooldownKey) ?? 0;
  if (lastSentAt && Date.now() - lastSentAt < TOKEN_EMAIL_COOLDOWN_MS) {
    throw new HttpError(429, "Please wait before requesting another email");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const result = addToken({
    token,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    purpose,
    userId,
  });

  if (!result) {
    throw new Error(`Failed to add token for ${purpose}`);
  }
  let subject = "";
  if (purpose === "reset_password") {
    subject = "Reset your password";
  } else if (purpose === "confirmation") {
    subject = "Confirm your email";
  }
  let link = "";
  if (purpose === "reset_password") {
    link = `${process.env.CLIENT_BASE_URL}/reset-password?token=${token}`;
  } else if (purpose === "confirmation") {
    link = `${process.env.CLIENT_BASE_URL}/registration/confirm-email?token=${token}`;
  }
  const email = await sendEmail(
    to,
    subject,
    `Click here to ${subject.toLowerCase()}: <a href="${link}">${subject}</a>`,
  );
  if (!email) {
    addUserActivity(userId, `Failed to send email for ${purpose}`);
    throw new Error(`Failed to send email for ${purpose}`);
  }
  tokenEmailLastSentAt.set(cooldownKey, Date.now());
  addUserActivity(userId, `Email sent for ${purpose}`);
  return { message: `Email sent for ${purpose}` };
}

export async function verifyToken(token: string, purpose: string) {
  const result = getToken(token, purpose);
  if (!result) {
    throw new HttpError(400, "Invalid token");
  }
  if (result.expiresAt && result.expiresAt < new Date().toISOString()) {
    throw new HttpError(400, "Token expired");
  }
  // If it's a confirmation token, issue JWT and delete token
  if (purpose === "confirmation") {
    const jwt = generateJwt(String(result.userId));
    deleteToken(token, purpose);
    addUserActivity(result.userId, "Email verified");
    return { userId: result.userId, jwt: jwt };
  }
  return { userId: result.userId };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  userId: string,
) {
  const tokenRecord = getToken(token, "reset_password");
  if (!tokenRecord) {
    throw new HttpError(400, "Invalid token");
  }
  if (
    tokenRecord.expiresAt &&
    tokenRecord.expiresAt < new Date().toISOString()
  ) {
    throw new HttpError(400, "Token expired");
  }
  if (String(tokenRecord.userId) !== userId) {
    throw new HttpError(403, "Token does not belong to this user");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  updateUser(userId, { password: hashedPassword });
  deleteToken(token, "reset_password");
  addUserActivity(userId, "Password reset");
  return { message: "Password reset successfully" };
}
