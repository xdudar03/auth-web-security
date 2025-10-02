import express from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import session from "express-session";
import cors from "cors";
import fs from "fs";
import { isoUint8Array } from "@simplewebauthn/server/helpers";

const app = express();
const port = 4000;
const USERS_FILE_TEMP = "src/users.json";

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
  })
);

function loadUsers() {
  const users = JSON.parse(fs.readFileSync(USERS_FILE_TEMP, "utf8"));
  return users;
}

function saveUsers(users: any) {
  fs.writeFileSync(USERS_FILE_TEMP, JSON.stringify(users, null, 2));
}

const users = loadUsers();
console.log("USERS FROM FILE:", users);

app.post("/registration/options", async (req, res) => {
  try {
    const { username, userId } = req.body;
    console.log("REQ BODY:", req.body);

    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    if (username in users) {
      return res.status(400).json({ error: `${username} already exists` });
    }

    const options = await generateRegistrationOptions({
      rpName: "Example RP",
      rpID: "localhost", // must match domain
      userName: username,
      userID: isoUint8Array.fromUTF8String(userId),
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
});

app.post("/registration/verify", async (req, res) => {
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
});

app.post("/authentication/options", async (req, res) => {
  console.log("THIS IS AUTHENTICATION OPTIONS");
  const { username } = req.body;
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
        id: cred.credential.id, // must be a Buffer
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
});

app.post("/authentication/verify", async (req, res) => {
  console.log("THIS IS AUTHENTICATION VERIFY");
  const body = req.body;
  const username = (req.session as any).username;
  const expectedChallenge = (req.session as any).challenge;
  const user = users[username];
  const credentials = user.credentials[0].credential;

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
    const { verified, authenticationInfo } = verification;
    if (verified && authenticationInfo) {
      (req.session as any).currentChallenge = authenticationInfo.credentialID;
      credentials.counter = authenticationInfo.newCounter;
    }
    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid authentication response" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
