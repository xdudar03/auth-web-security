import express from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import session from "express-session";
import cors from "cors";

const app = express();
const port = 4000;

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

const users: Record<string, any> = {};

app.post("/registration/options", async (req, res) => {
  try {
    const { username } = req.body;
    console.log("REQ BODY:", req.body);

    if (!username) {
      return res
        .status(400)
        .json({ error: "userId and username are required" });
    }

    const options = await generateRegistrationOptions({
      rpName: "Example RP",
      rpID: "localhost", // must match domain
      userName: username,
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
      const { userId, username } = req.session as any;
      users[userId] = {
        username,
        credentials: [registrationInfo],
      };
    }
    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Invalid registration response" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
