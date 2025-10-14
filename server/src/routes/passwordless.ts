import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { db, updateUser } from "../database.ts";
import { mapResponseQuery } from "../utils.ts";
import { Router } from "express";

const router = Router();

router.post("/authentication/options", async (req, res) => {
  await authenticateOptions(req, res);
});

router.post("/authentication/verify", async (req, res) => {
  await authenticateVerify(req, res);
});

router.post("/registration/options", async (req, res) => {
  await registredOptions(req, res);
});

router.post("/registration/verify", async (req, res) => {
  await registeredVerify(req, res);
});

export default router;

function toBase64URL(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64URL(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export const registredOptions = async (req: any, res: any) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    const users = db.prepare("SELECT * FROM users").all();
    const user = users.find((u: any) => u.username === username);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log("USER:", user);

    let credentials: any[] = [];
    if (user.credentials) {
      try {
        credentials = JSON.parse(user.credentials as string) || [];
      } catch {
        credentials = [];
      }
    }
    console.log("CREDENTIALS:", credentials);

    // const userIdStr =
    //   typeof user.userId === "string" ? user.userId : String(user.userId);
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
      timeout: 60000,
    });

    console.log("OPTIONS GENERATED:", options);

    (req.session as any).challenge = options.challenge;
    (req.session as any).username = username;
    (req.session as any).userId = user.userId;
    return res.json(options);
  } catch (error) {
    console.error("Error in registration options:", error);
    return res.status(500).json({ error: String(error) });
  }
};
// TODO: figure out a way how to use fewer queries
export const registeredVerify = async (req: any, res: any) => {
  console.log("THIS IS REGISTERED VERIFY");
  const body = req.body;
  const expectedChallenge = (req.session as any).challenge;
  const username = (req.session as any).username;
  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      requireUserVerification: false,
    });
    console.log("VERIFICATION:", verification);
    const { verified, registrationInfo } = verification as any;
    console.log("VERIFIED:", verified);
    console.log("REGISTRATION INFO:", registrationInfo);
    if (verified && registrationInfo) {
      const response = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username);
      if (!response) {
        return res.status(404).json({ error: "User not found" });
      }

      let credentials: any[] = [];
      if (response.credentials) {
        try {
          credentials = JSON.parse(response.credentials as string) || [];
        } catch {
          credentials = [];
        }
      }
      console.log("CREDENTIALS IN REGISTERED VERIFY:", credentials);
      const newAuthenticator = {
        credentialID: registrationInfo.credential.id,
        credentialPublicKey: toBase64URL(registrationInfo.credential.publicKey),
        counter: registrationInfo.credential.counter,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        transports: registrationInfo.credential.transports || ["internal"],
      };
      console.log("NEW AUTHENTICATOR:", newAuthenticator);
      // Merge, avoiding duplicates by credentialID
      const withoutDup = credentials.filter(
        (c: any) => c.credentialID !== newAuthenticator.credentialID
      );
      const updated = [...withoutDup, newAuthenticator];
      updateUser(response.id as number, {
        credentials: JSON.stringify(updated),
      });
    }
    const query = db
      .prepare(
        "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ?"
      )
      .get(username);
    const response = mapResponseQuery(query);
    console.log("RESPONSE IN REGISTERED VERIFY:", response);
    return res.json({ verified, response });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid registration response" });
  }
};

export const authenticateOptions = async (req: any, res: any) => {
  console.log("THIS IS AUTHENTICATION OPTIONS");
  const { username } = req.body;
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  if (user?.credentials) {
    user.credentials = JSON.parse(user.credentials as string);
  }

  console.log("USER CREDENTIALS IN AUTHENTICATION OPTIONS:", user.credentials);

  try {
    const credentialsArray = Array.isArray(user.credentials)
      ? user.credentials
      : [];
    console.log(
      "CREDENTIALS ARRAY IN AUTHENTICATION OPTIONS:",
      credentialsArray
    );
    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      allowCredentials: credentialsArray.map((cred: any) => ({
        id: cred.credentialID,
        transports: cred.transports || ["internal"],
      })),
      timeout: 60000,
      userVerification: "required",
    });

    (req.session as any).challenge = options.challenge;
    (req.session as any).userId = user.userId;
    (req.session as any).username = user.username;

    return res.json(options);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid authentication response" });
  }
};

export const authenticateVerify = async (req: any, res: any) => {
  console.log("THIS IS AUTHENTICATION VERIFY");
  const body = req.body;
  const username = (req.session as any).username;
  const expectedChallenge = (req.session as any).challenge;
  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ?"
    )
    .get(username);
  const response = mapResponseQuery(query);
  if (response.user?.credentials) {
    response.user.credentials = JSON.parse(response.user.credentials as string);
  }
  if (!response.user) {
    return res.status(404).json({ error: "User not found" });
  }

  console.log("CREDENTIALS:", response.user?.credentials);
  console.log("EXPECTED CHALLENGE:", expectedChallenge);
  console.log("USERNAME:", username);
  console.log("BODY:", body);
  console.log("USER:", response.user);

  try {
    const credentialsArray: any[] = Array.isArray(response.user?.credentials)
      ? (response.user?.credentials as any[])
      : [];
    const authenticator = credentialsArray.find(
      (c: any) => c.credentialID === body.id
    );
    if (!authenticator) {
      return res.status(400).json({ error: "Authenticator not found" });
    }
    console.log("AUTHENTICATOR: ", authenticator);
    const verification = await verifyAuthenticationResponse({
      response: body,
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
    console.log("VERIFICATION:", verification);
    const { verified, authenticationInfo } = verification as any;
    console.log("VERIFIED:", verified);
    console.log("AUTHENTICATION INFO:", authenticationInfo);
    if (verified && authenticationInfo) {
      // Update counter
      const updatedCreds = credentialsArray.map((c: any) =>
        c.credentialID === authenticator.credentialID
          ? { ...c, counter: authenticationInfo.newCounter }
          : c
      );
      updateUser(response.user.id as number, {
        credentials: JSON.stringify(updatedCreds),
      });
    }
    return res.json({ verified, response });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Invalid authentication response" });
  }
};
