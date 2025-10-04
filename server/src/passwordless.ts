import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { saveUsers, loadUsers } from "./server.ts";

export const registredOptions = async (req: any, res: any) => {
  try {
    const { username, userId } = req.body;
    console.log("REQ BODY:", req.body);

    if (!username) {
      res.status(400).json({ error: "username is required" });
    }

    const users = loadUsers();

    if (users[username]) {
      res.status(400).json({ error: `${username} already exists` });
    }

    const options = await generateRegistrationOptions({
      rpName: "Example RP",
      rpID: "localhost", // must match domain
      userName: username,
      userID: isoUint8Array.fromUTF8String(userId), // must be a Uint8Array, but wont write it to json
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
      },
      excludeCredentials: [],
      timeout: 60000,
    });

    console.log("OPTIONS GENERATED:", options);

    (req.session as any).challenge = options.challenge;
    (req.session as any).username = username;
    (req.session as any).userId = userId;
    res.json(options);
  } catch (error) {
    console.error("Error in registration options:", error);
    res.status(500).json({ error: String(error) });
  }
};

export const registeredVerify = async (req: any, res: any) => {
  const body = req.body;
  const expectedChallenge = (req.session as any).challenge;

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      requireUserVerification: false,
    });
    const { verified, registrationInfo } = verification;
    if (verified && registrationInfo) {
      const { username, userId } = req.session as any;
      const users = loadUsers();
      users[username] = {
        username,
        credentials: [registrationInfo],
        userId,
      };
      saveUsers(users);
    }
    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid registration response" });
  }
};

export const authenticateOptions = async (req: any, res: any) => {
  console.log("THIS IS AUTHENTICATION OPTIONS");
  const { username } = req.body;
  const users = loadUsers();
  const user = Object.values(users).find(
    (user: any) => user.username === username
  );

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  try {
    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      allowCredentials: user.credentials.map((cred: any) => ({
        id: cred.credential.id, // must be a base64 string
        transports: cred.credential.transports || ["internal"],
      })),
      challenge: (req.session as any).challenge,
      timeout: 60000,
      userVerification: "required",
    });

    (req.session as any).challenge = options.challenge;
    (req.session as any).userId = user.userId;
    (req.session as any).username = user.username;

    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid authentication response" });
  }
};

export const authenticateVerify = async (req: any, res: any) => {
  console.log("THIS IS AUTHENTICATION VERIFY");
  const body = req.body;
  const username = (req.session as any).username;
  const expectedChallenge = (req.session as any).challenge;
  const users = loadUsers();
  const user = users[username];
  const credentials = user.credentials[0].credential;

  console.log("CREDENTIALS:", credentials);
  console.log("EXPECTED CHALLENGE:", expectedChallenge);
  console.log("USERNAME:", username);
  console.log("BODY:", body);
  console.log("USER:", user);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: `${expectedChallenge}`,
      expectedOrigin: "http://localhost:3000",
      expectedRPID: "localhost",
      credential: {
        id: credentials.id,
        publicKey: credentials.publicKey,
        counter: credentials.counter,
      },
      requireUserVerification: false,
    });
    console.log("VERIFICATION:", verification);
    const { verified, authenticationInfo } = verification;
    if (verified && authenticationInfo) {
      (req.session as any).currentChallenge = authenticationInfo.credentialID;
      credentials.counter = authenticationInfo.newCounter;
      console.log("AUTHENTICATION INFO:", authenticationInfo);
    }
    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid authentication response" });
  }
};
