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
  getAllUsers,
  getUserById,
  getUserByUsername,
  updateUser,
} from "../database.ts";
import { generateJwt } from "./biometric.ts";
import type { User } from "../types/user.ts";

export type ChallengeSession = Session & {
  challenge?: string;
  userId?: string;
};

function toBase64URL(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64URL(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function assertSession(
  session: ChallengeSession | undefined
): asserts session is ChallengeSession {
  if (!session) {
    throw new HttpError(500, "Session is not initialized");
  }
}

export async function getRegistrationOptions(
  userId: string,
  session?: ChallengeSession
) {
  assertSession(session);

  if (!userId) {
    throw new HttpError(400, "userId is required");
  }

  const users = getAllUsers();
  const user = users.find((u: User) => u.userId === userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  let credentials: any[] = [];
  if (user.credentials) {
    try {
      credentials = JSON.parse(user.credentials as string) || [];
    } catch {
      credentials = [];
    }
  }

  try {
    const options = await generateRegistrationOptions({
      rpName: "Example RP",
      rpID: "localhost",
      userName: user.username!,
      userID: isoUint8Array.fromUTF8String(user.userId as string),
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
      },
      excludeCredentials: credentials.map((cred: any) => ({
        id: cred.credentialID,
        transports: cred.transports || ["internal"],
      })),
      timeout: 60_000,
    });

    session.challenge = options.challenge;
    session.userId = user.userId as string;

    return options;
  } catch (error) {
    console.error("Error generating registration options", error);
    throw new HttpError(500, "Failed to generate registration options");
  }
}

export async function verifyRegistration(
  responseBody: unknown,
  session?: ChallengeSession
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
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      requireUserVerification: false,
    });

    const { verified, registrationInfo } = verification as any;

    if (verified && registrationInfo) {
      const userRecord = getUserById(userId);
      if (!userRecord) {
        throw new HttpError(404, "User not found");
      }

      let credentials: any[] = [];
      if (userRecord.credentials) {
        try {
          credentials = JSON.parse(userRecord.credentials as string) || [];
        } catch {
          credentials = [];
        }
      }

      const newAuthenticator = {
        credentialID: registrationInfo.credential.id,
        credentialPublicKey: toBase64URL(registrationInfo.credential.publicKey),
        counter: registrationInfo.credential.counter,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        transports: registrationInfo.credential.transports || ["internal"],
      };

      const filtered = credentials.filter(
        (c: any) => c.credentialID !== newAuthenticator.credentialID
      );
      const updated = [...filtered, newAuthenticator];
      updateUser(userRecord.userId as string, {
        credentials: JSON.stringify(updated),
      });
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
  session?: ChallengeSession
) {
  assertSession(session);

  const user = getUserByUsername(username);

  if (!user) {
    throw new HttpError(400, "User not found");
  }

  if (user.credentials) {
    try {
      user.credentials = JSON.parse(user.credentials as string);
    } catch {
      user.credentials = [] as any;
    }
  }

  try {
    const credentialsArray = Array.isArray(user.credentials)
      ? user.credentials
      : [];

    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      allowCredentials: credentialsArray.map((cred: any) => ({
        id: cred.credentialID,
        transports: cred.transports || ["internal"],
      })),
      timeout: 60_000,
      userVerification: "required",
    });

    session.challenge = options.challenge;
    session.userId = user.userId as string;

    return options;
  } catch (error) {
    console.error("Error generating authentication options", error);
    throw new HttpError(400, "Invalid authentication response");
  }
}

export async function verifyAuthentication(
  responseBody: any,
  session?: ChallengeSession
) {
  assertSession(session);
  console.log("responseBody", responseBody);
  console.log("session", session);
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

    let credentialsArray: any[] = [];
    if (query.credentials) {
      try {
        const parsed = JSON.parse(query.credentials as string);
        credentialsArray = Array.isArray(parsed) ? parsed : [];
      } catch {
        credentialsArray = [];
      }
    }

    const authenticator = credentialsArray.find(
      (c: any) => c.credentialID === responseBody.id
    );

    if (!authenticator) {
      throw new HttpError(400, "Authenticator not found");
    }

    const verification = await verifyAuthenticationResponse({
      response: responseBody,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      credential: {
        id: authenticator.credentialID,
        publicKey: fromBase64URL(authenticator.credentialPublicKey),
        counter: authenticator.counter || 0,
      },
      requireUserVerification: false,
    } as any);

    const { verified, authenticationInfo } = verification as any;

    if (verified && authenticationInfo) {
      const updatedCreds = credentialsArray.map((c: any) =>
        c.credentialID === authenticator.credentialID
          ? { ...c, counter: authenticationInfo.newCounter }
          : c
      );
      updateUser(query.userId as string, {
        credentials: JSON.stringify(updatedCreds),
      });
    }

    return { verified, jwt: generateJwt(query.userId as string) };
  } catch (error) {
    console.error("Error verifying authentication", error);
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "Invalid authentication response");
  }
}

export const passwordlessSessionKeys = {
  challenge: "challenge" as const,
  userId: "userId" as const,
};

export function clearPasswordlessSession(session?: ChallengeSession) {
  if (!session) return;
  delete session.challenge;
  delete session.userId;
}
