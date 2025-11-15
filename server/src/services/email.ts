import { sendEmail } from "../tools/mailer.ts";
import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import { addToken, deleteToken, getToken, updateUser } from "../database.ts";
import { HttpError } from "../errors.ts";
import { generateJwt } from "./biometric.ts";

export async function sendEmailWithToken(
  to: string,
  userId: string,
  purpose: string
) {
  const token = crypto.randomBytes(32).toString("hex");
  console.log("token for ", purpose, token);
  const result = addToken({
    token,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    purpose,
    userId,
  });

  console.log("result of adding token for ", purpose, result);
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
    `Click here to ${subject.toLowerCase()}: <a href="${link}">${subject}</a>`
  );
  if (!email) {
    throw new Error(`Failed to send email for ${purpose}`);
  }
  return { message: `Email sent for ${purpose}` };
}

export async function verifyToken(token: string, purpose: string) {
  const result = getToken(token, purpose);
  console.log("result of verifying token for ", purpose, result);
  if (!result) {
    throw new HttpError(400, "Invalid token");
  }
  if (result.expiresAt && result.expiresAt < new Date().toISOString()) {
    throw new HttpError(400, "Token expired");
  }
  // If it's a confirmation token, issue JWT and delete token
  if (purpose === "confirmation") {
    const jwt = generateJwt(String(result.userId));
    console.log("jwt in verifyToken: ", jwt);
    deleteToken(token, purpose);
    return { userId: result.userId, jwt: jwt };
  }
  return { userId: result.userId };
}

export function resetPassword(
  token: string,
  newPassword: string,
  userId: string
) {
  updateUser(userId, { password: newPassword });
  deleteToken(token, "reset_password");
  return { message: "Password reset successfully" };
}
