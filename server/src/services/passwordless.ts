import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type { Session } from "express-session";
import { HttpError } from "../errors.ts";
import { db, getUserShops, updateUser } from "../database.ts";
import { mapResponseQuery } from "../utils.ts";

export type ChallengeSession = Session & {
  challenge?: string;
  username?: string;
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
  username: string,
  session?: ChallengeSession
) {
  assertSession(session);

  if (!username) {
    throw new HttpError(400, "username is required");
  }

  const users = db.prepare("SELECT * FROM users").all();
  const user = users.find((u: any) => u.username === username);
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
      userName: username,
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
    session.username = username;
    session.userId = user?.userId as string;

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
  const username = session.username;

  if (!expectedChallenge || !username) {
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
      const userRecord = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username);
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

    const query = db
      .prepare(
        "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE username = ?"
      )
      .get(username);

    const shops = getUserShops.all(query?.userId as string);
    const response = mapResponseQuery({
      ...query,
      shops,
    });
    return { verified, user: response.user, role: response.role, shops: shops };
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

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

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
    session.username = user.username as string;

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
  const username = session.username;

  if (!username || !expectedChallenge) {
    throw new HttpError(400, "Authentication session is missing data");
  }

  try {
    const query = db
      .prepare(
        "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE username = ?"
      )
      .get(username);

    if (!query) {
      throw new HttpError(404, "User not found");
    }

    const shops = getUserShops.all(query?.userId as string);
    const response = mapResponseQuery({
      ...query,
      shops,
    });
    console.log("response", response);

    if (response.user?.credentials) {
      try {
        response.user.credentials = JSON.parse(
          response.user.credentials as string
        );
      } catch {
        response.user.credentials = [];
      }
    }

    const credentialsArray: any[] = Array.isArray(response.user?.credentials)
      ? (response.user?.credentials as any[])
      : [];

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
      updateUser(response.user.userId as string, {
        credentials: JSON.stringify(updatedCreds),
      });
    }

    const userShops = getUserShops.all(response.user.userId as string);
    return {
      verified,
      user: response.user,
      role: response.role,
      shops: userShops,
    };
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
  username: "username" as const,
  userId: "userId" as const,
};

export function clearPasswordlessSession(session?: ChallengeSession) {
  if (!session) return;
  delete session.challenge;
  delete session.username;
  delete session.userId;
}
