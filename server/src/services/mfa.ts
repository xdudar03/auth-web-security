import crypto from "crypto";
import { addUserActivity, getUserById } from "../database.ts";
import { HttpError } from "../errors.ts";
import { hashEmailForSeed } from "../lib/encryption.ts";
import { sendEmail } from "../tools/mailer.ts";
import { jwtSecret } from "../tools/trpc.ts";
import type { User } from "../types/user.ts";
import type { ChallengeSession } from "./passwordless.ts";
import jwt from "jsonwebtoken";

const MFA_CODE_TTL_MS = 10 * 60 * 1000;
const MFA_RESEND_COOLDOWN_MS = 30 * 1000;
const MFA_MAX_ATTEMPTS = 5;

type AuthFactorMethod = "password" | "passwordless" | "biometric";

type PasskeyCredentialRecord = {
  credentialID: string;
  wrappedPrivateKey?: string;
  wrappedPrivateKeyIv?: string;
  wrapSaltB64?: string;
};

function parseCredentials(
  raw: string | null | undefined,
): PasskeyCredentialRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PasskeyCredentialRecord[]) : [];
  } catch {
    return [];
  }
}

function buildSuccessResponse(
  user: User,
  firstFactor: AuthFactorMethod,
  session?: ChallengeSession,
) {
  const matchingCredential =
    firstFactor === "passwordless" && session?.verifiedCredentialId
      ? parseCredentials(user.credentials ?? null).find(
          (credential) =>
            credential.credentialID === session.verifiedCredentialId,
        )
      : null;

  return {
    requiresMfa: false as const,
    jwt: jwt.sign({ userId: user.userId }, jwtSecret, { expiresIn: "1h" }),
    credentialId: matchingCredential?.credentialID ?? null,
    passkeyWrappedPrivateKey: matchingCredential?.wrappedPrivateKey ?? null,
    passkeyWrappedPrivateKeyIv: matchingCredential?.wrappedPrivateKeyIv ?? null,
    passkeyWrapSaltB64: matchingCredential?.wrapSaltB64 ?? null,
    hpkePublicKeyB64: user.hpkePublicKeyB64 ?? null,
    recoverySaltB64: user.recoverySaltB64 ?? null,
    encryptedPrivateKey: user.encryptedPrivateKey ?? null,
    encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? null,
  };
}

export function clearMfaSession(session?: ChallengeSession) {
  if (!session) return;
  delete session.mfa;
}

export function beginMfaChallenge(
  user: User,
  firstFactor: AuthFactorMethod,
  session?: ChallengeSession,
) {
  if (!session) {
    throw new HttpError(500, "Session is not initialized");
  }

  session.mfa = {
    userId: user.userId,
    firstFactor,
    attempts: 0,
  };

  return {
    requiresMfa: true as const,
    mfaMethod: "email_otp" as const,
    message: "Enter your account email to receive a verification code.",
  };
}

export function completePrimaryAuthentication(
  user: User,
  firstFactor: AuthFactorMethod,
  session?: ChallengeSession,
) {
  if (user.MFAEnabled) {
    return beginMfaChallenge(user, firstFactor, session);
  }

  clearMfaSession(session);
  if (firstFactor !== "passwordless" && session) {
    delete session.verifiedCredentialId;
  }
  return buildSuccessResponse(user, firstFactor, session);
}

export async function sendMfaCode(email: string, session?: ChallengeSession) {
  if (!session?.mfa?.userId) {
    throw new HttpError(401, "MFA challenge not started");
  }

  const user = getUserById(session.mfa.userId);
  if (!user) {
    clearMfaSession(session);
    throw new HttpError(404, "User not found");
  }

  const emailHash = hashEmailForSeed(email);
  if (!user.emailHash || emailHash !== user.emailHash) {
    throw new HttpError(400, "Email address does not match this account");
  }

  const lastSentAt = session.mfa.lastSentAt
    ? new Date(session.mfa.lastSentAt).getTime()
    : 0;
  if (lastSentAt && Date.now() - lastSentAt < MFA_RESEND_COOLDOWN_MS) {
    throw new HttpError(429, "Please wait before requesting another code");
  }

  const code = crypto.randomInt(100000, 1000000).toString(); // 6 digit code
  const expiresAt = new Date(Date.now() + MFA_CODE_TTL_MS).toISOString();

  const delivery = await sendEmail(
    email,
    "Your MFA verification code",
    `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
  );

  if (!delivery) {
    addUserActivity(user.userId, "Failed to send MFA verification code");
    throw new HttpError(500, "Failed to send MFA verification code");
  }

  session.mfa = {
    ...session.mfa,
    attempts: 0,
    code,
    expiresAt,
    lastSentAt: new Date().toISOString(),
  };

  addUserActivity(
    user.userId,
    `MFA verification code sent (${session.mfa.firstFactor})`,
  );

  return {
    message: `Verification code sent to ${email}`,
  };
}

export function verifyMfaCode(code: string, session?: ChallengeSession) {
  if (!session?.mfa?.userId) {
    throw new HttpError(401, "MFA challenge not started");
  }

  const pendingMfa = session.mfa;
  const user = getUserById(pendingMfa.userId);
  if (!user) {
    clearMfaSession(session);
    throw new HttpError(404, "User not found");
  }

  if (!pendingMfa.code || !pendingMfa.expiresAt) {
    throw new HttpError(400, "Request a verification code first");
  }

  if (new Date(pendingMfa.expiresAt).getTime() < Date.now()) {
    clearMfaSession(session);
    throw new HttpError(400, "Verification code expired");
  }

  if (pendingMfa.attempts >= MFA_MAX_ATTEMPTS) {
    clearMfaSession(session);
    throw new HttpError(429, "Too many incorrect verification attempts");
  }

  if (pendingMfa.code !== code.trim()) {
    session.mfa = {
      ...pendingMfa,
      attempts: pendingMfa.attempts + 1,
    };
    throw new HttpError(400, "Invalid verification code");
  }

  addUserActivity(user.userId, `MFA verified (${pendingMfa.firstFactor})`);

  const response = buildSuccessResponse(user, pendingMfa.firstFactor, session);
  if (pendingMfa.firstFactor !== "passwordless") {
    delete session.verifiedCredentialId;
  }
  clearMfaSession(session);

  return response;
}
