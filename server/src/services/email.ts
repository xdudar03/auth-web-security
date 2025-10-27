import { sendEmail } from "../tools/mailer.ts";
import dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import { addToken, deleteToken, getToken, updateUser } from "../database.ts";
import { HttpError } from "../errors.ts";

export async function sendEmailWithToken(
  to: string,
  userId: string,
  purpose: string
) {
  const token = crypto.randomBytes(32).toString("hex");
  console.log("token for ", purpose, token);
  const result = addToken.run(
    token,
    new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    purpose,
    userId
  ); // 1 day
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

export function verifyToken(token: string, purpose: string) {
  const result = getToken.get(token, purpose);
  console.log("result of verifying token for ", purpose, result);
  if (!result) {
    throw new HttpError(400, "Invalid token");
  }
  if (result.expiresAt && result.expiresAt < new Date().toISOString()) {
    throw new HttpError(400, "Token expired");
  }
  return { userId: result.userId };
}

export function resetPassword(
  token: string,
  newPassword: string,
  userId: string
) {
  updateUser(userId, { password: newPassword });
  deleteToken.run(token, "reset_password");
  return { message: "Password reset successfully" };
}
