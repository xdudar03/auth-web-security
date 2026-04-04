import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type { Session } from "express-session";
import { HttpError } from "../errors.ts";
import {
  addUserActivity,
  getUserById,
  getUserByUsername,
  updateUser,
} from "../database.ts";
import { generateJwt } from "./user.ts";

export type ChallengeSession = Session & {
  challenge?: string;
  userId?: string;
  verifiedCredentialId?: string;
};

type PasskeyCredentialRecord = {
  credentialID: string;
  credentialPublicKey: string;
  counter?: number;
  transports?: string[];
  wrappedPrivateKey?: string;
  wrappedPrivateKeyIv?: string;
  wrapSaltB64?: string;
};

function resolveExpectedOrigin(): string {
  const raw = process.env.CLIENT_BASE_URL?.trim();
  if (!raw) {
    return "http://localhost:3000";
  }

  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function resolveRpId(): string {
  const explicitRpId = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicitRpId) {
    return explicitRpId;
  }

  const rawClientBaseUrl = process.env.CLIENT_BASE_URL?.trim();
  if (rawClientBaseUrl) {
    try {
      return new URL(rawClientBaseUrl).hostname;
    } catch {
      return "localhost";
    }
  }

  return "localhost";
}

function toBase64URL(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64URL(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

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

function assertSession(
  session: ChallengeSession | undefined,
): asserts session is ChallengeSession {
  if (!session) {
    throw new HttpError(500, "Session is not initialized");
  }
}

export async function getRegistrationOptions(
  userId: string,
  session?: ChallengeSession,
) {
  assertSession(session);

  if (!userId) {
    throw new HttpError(400, "userId is required");
  }

  const user = getUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const credentials = parseCredentials(user.credentials ?? null);

  try {
    const options = await generateRegistrationOptions({
      rpName: "Example RP",
      rpID: resolveRpId(),
      userName: user.username!,
      userID: isoUint8Array.fromUTF8String(user.userId as string),
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
      },
      excludeCredentials: credentials.map((cred) => ({
        id: cred.credentialID,
        transports: (cred.transports as any) || ["internal"],
      })),
      timeout: 60_000,
    });

    session.challenge = options.challenge;
    session.userId = user.userId as string;
    delete session.verifiedCredentialId;

    return options;
  } catch (error) {
    console.error("Error generating registration options", error);
    throw new HttpError(500, "Failed to generate registration options");
  }
}

export async function verifyRegistration(
  responseBody: unknown,
  session?: ChallengeSession,
) {
  assertSession(session);

  const expectedChallenge = session.challenge;
  const userId = session.userId;

  if (!expectedChallenge || !userId) {
    throw new HttpError(400, "Registration session is missing data");
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: responseBody as any,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: resolveExpectedOrigin(),
      expectedRPID: resolveRpId(),
      requireUserVerification: true,
    });

    const { verified, registrationInfo } = verification as any;

    if (verified && registrationInfo) {
      const userRecord = getUserById(userId);
      if (!userRecord) {
        throw new HttpError(404, "User not found");
      }

      const credentials = parseCredentials(userRecord.credentials ?? null);

      const newAuthenticator = {
        credentialID: registrationInfo.credential.id,
        credentialPublicKey: toBase64URL(registrationInfo.credential.publicKey),
        counter: registrationInfo.credential.counter,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        transports: registrationInfo.credential.transports || ["internal"],
      };

      const filtered = credentials.filter(
        (c) => c.credentialID !== newAuthenticator.credentialID,
      );
      const updated = [...filtered, newAuthenticator];
      updateUser(userRecord.userId as string, {
        credentials: JSON.stringify(updated),
      });

      addUserActivity(userRecord.userId as string, "Passkey registered");

      clearPasswordlessSession(session);
    }

    return { verified };
  } catch (error) {
    console.error("Error verifying registration", error);
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Invalid registration response");
  }
}

export async function getAuthenticationOptions(
  username: string,
  session?: ChallengeSession,
) {
  assertSession(session);

  const user = getUserByUsername(username);

  if (!user) {
    throw new HttpError(400, "User not found");
  }

  try {
    const credentialsArray = parseCredentials(user.credentials ?? null);

    const options = await generateAuthenticationOptions({
      rpID: resolveRpId(),
      allowCredentials: credentialsArray.map((cred) => ({
        id: cred.credentialID,
        transports: (cred.transports as any) || ["internal"],
      })),
      timeout: 60_000,
      userVerification: "required",
    });

    session.challenge = options.challenge;
    session.userId = user.userId as string;
    delete session.verifiedCredentialId;

    return options;
  } catch (error) {
    console.error("Error generating authentication options", error);
    throw new HttpError(400, "Invalid authentication response");
  }
}

export async function verifyAuthentication(
  responseBody: any,
  session?: ChallengeSession,
) {
  assertSession(session);
  const expectedChallenge = session.challenge;
  const userId = session.userId;

  if (!userId || !expectedChallenge) {
    throw new HttpError(400, "Authentication session is missing data");
  }

  try {
    const query = getUserById(userId);

    if (!query) {
      throw new HttpError(404, "User not found");
    }

    const credentialsArray = parseCredentials(query.credentials ?? null);

    const authenticator = credentialsArray.find(
      (c) => c.credentialID === responseBody.id,
    );

    if (!authenticator) {
      throw new HttpError(400, "Authenticator not found");
    }

    const verification = await verifyAuthenticationResponse({
      response: responseBody,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: resolveExpectedOrigin(),
      expectedRPID: resolveRpId(),
      credential: {
        id: authenticator.credentialID,
        publicKey: fromBase64URL(authenticator.credentialPublicKey),
        counter: authenticator.counter || 0,
      },
      extensions: {
        prf: {},
      },
      requireUserVerification: true,
    } as any);

    const { verified, authenticationInfo } = verification as any;

    if (!verified) {
      throw new HttpError(401, "Passwordless authentication failed");
    }

    if (verified && authenticationInfo) {
      const updatedCreds = credentialsArray.map((c) =>
        c.credentialID === authenticator.credentialID
          ? { ...c, counter: authenticationInfo.newCounter }
          : c,
      );
      updateUser(query.userId as string, {
        credentials: JSON.stringify(updatedCreds),
      });
      addUserActivity(
        query.userId as string,
        "User authenticated (passwordless login)",
      );
      session.verifiedCredentialId = authenticator.credentialID;
      delete session.challenge;
    }

    return {
      verified,
      jwt: generateJwt(query.userId as string),
      credentialId: authenticator.credentialID,
      passkeyWrappedPrivateKey: authenticator.wrappedPrivateKey ?? null,
      passkeyWrappedPrivateKeyIv: authenticator.wrappedPrivateKeyIv ?? null,
      passkeyWrapSaltB64: authenticator.wrapSaltB64 ?? null,
      hpkePublicKeyB64: query.hpkePublicKeyB64 ?? null,
      recoverySaltB64: query.recoverySaltB64 ?? null,
      encryptedPrivateKey: query.encryptedPrivateKey ?? null,
      encryptedPrivateKeyIv: query.encryptedPrivateKeyIv ?? null,
    };
  } catch (error) {
    console.error("Error verifying authentication", error);
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Invalid authentication response");
  }
}

export async function saveCredentialKeyMaterial(
  input: {
    credentialId: string;
    wrappedPrivateKey: string;
    wrappedPrivateKeyIv: string;
    wrapSaltB64: string;
  },
  session?: ChallengeSession,
) {
  assertSession(session);
  if (!session.userId) {
    throw new HttpError(
      401,
      "Passwordless session missing user context for key material update",
    );
  }

  if (!session.verifiedCredentialId) {
    throw new HttpError(
      403,
      "Passwordless verification required before saving credential material",
    );
  }

  if (session.verifiedCredentialId !== input.credentialId) {
    throw new HttpError(
      403,
      "Credential key material update is not allowed for this credential",
    );
  }

  const user = getUserById(session.userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const credentials = parseCredentials(user.credentials ?? null);
  const matching = credentials.find(
    (c) => c.credentialID === input.credentialId,
  );
  if (!matching) {
    throw new HttpError(400, "Credential not found for current session user");
  }

  const updatedCredentials = credentials.map((credential) =>
    credential.credentialID === input.credentialId
      ? {
          ...credential,
          wrappedPrivateKey: input.wrappedPrivateKey,
          wrappedPrivateKeyIv: input.wrappedPrivateKeyIv,
          wrapSaltB64: input.wrapSaltB64,
        }
      : credential,
  );

  updateUser(user.userId, {
    credentials: JSON.stringify(updatedCredentials),
  });

  delete session.verifiedCredentialId;

  return { saved: true };
}

export const passwordlessSessionKeys = {
  challenge: "challenge" as const,
  userId: "userId" as const,
};

export function clearPasswordlessSession(session?: ChallengeSession) {
  if (!session) return;
  delete session.challenge;
  delete session.userId;
  delete session.verifiedCredentialId;
}
