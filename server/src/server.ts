import express from "express";
import session from "express-session";
import cors from "cors";
import fs from "fs";
import "dotenv/config";
import { addUser, db } from "./database.js";
import {
  authenticateOptions,
  authenticateVerify,
  registeredVerify,
  registredOptions,
} from "./passwordless.ts";

console.log("Init server");

const app = express();
const port = 4000;
const USERS_FILE_TEMP = "src/users.json";
const MODEL_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:5000";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const usersFromDB = db.prepare("SELECT * FROM users").all();
console.log("USERS FROM DB:", usersFromDB);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

export function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE_TEMP)) return [];
    const users = JSON.parse(fs.readFileSync(USERS_FILE_TEMP, "utf8"));
    return users;
  } catch (err) {
    console.warn("Failed to load users from file:", err);
    return [];
  }
}

export function saveUsers(users: any) {
  fs.writeFileSync(USERS_FILE_TEMP, JSON.stringify(users, null, 2));
}

app.post("/passwordless/registration/options", async (req, res) => {
  await registredOptions(req, res);
});

app.post("/passwordless/registration/verify", async (req, res) => {
  await registeredVerify(req, res);
});

app.post("/passwordless/authentication/options", async (req, res) => {
  await authenticateOptions(req, res);
});

app.post("/passwordless/authentication/verify", async (req, res) => {
  await authenticateVerify(req, res);
});

app.post("/biometric/registration", async (req, res) => {
  console.log("REQ BODY:", req.body);
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  console.log("USERS FROM DB:", usersFromDB);
  const { username, password, embedding, id } = req.body;
  // add user to database
  if (usersFromDB.find((user: any) => user.userId === id)) {
    res.status(400).json({ error: "User already exists" });
  }
  addUser.run(id, username, password, embedding);
  console.log("USER ADDED TO DB:", db.prepare("SELECT * FROM users").all());
  res.status(200).json({ message: "Registration successful" });
});

app.post("/biometric/authentication", async (req, res) => {
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const { username, password } = req.body;
  const user = usersFromDB.find((user: any) => user.username === username);
  if (!user) {
    res.status(400).json({ error: "User not found" });
  } else if (user.password !== password) {
    res.status(400).json({ error: "Invalid password" });
  }
  console.log("USER FOUND:", user);
  res.status(200).json(user);
});

// ------------------------- MODEL (Flask) INTEGRATION -------------------------
app.get("/model/health", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/`);
    res.status(200).json({ ok: true, status: r.status });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: String(err) });
  }
});

app.post("/model/check-photo", async (req, res) => {
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl) {
      return res.status(400).json({ error: "dataUrl is required" });
    }

    const r = await fetch(`${MODEL_BASE_URL}/api/check_photo_json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

app.post("/model/dataset/yaleface", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/load_yaleface`, {
      method: "POST",
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

app.post("/model/dataset/lfw", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/load_lfw`, { method: "POST" });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

app.post("/model/dataset/delete", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/delete_db`, {
      method: "POST",
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  const users = loadUsers();
  console.log("USERS FROM FILE:", users);
  // console.log("USERS FROM DB:", usersFromDB);
});
