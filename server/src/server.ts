import express from "express";
import session from "express-session";
import cors from "cors";
import fs from "fs";
// import { db } from "./database.js";
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

// const usersFromDB = db.prepare("SELECT * FROM users").all();
// console.log("USERS FROM DB:", usersFromDB);

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

export function loadUsers() {
  const users = JSON.parse(fs.readFileSync(USERS_FILE_TEMP, "utf8"));
  return users;
}

export function saveUsers(users: any) {
  fs.writeFileSync(USERS_FILE_TEMP, JSON.stringify(users, null, 2));
}

app.post("passwordless/registration/options", async (req, res) => {
  await registredOptions(req, res);
});

app.post("passwordless/registration/verify", async (req, res) => {
  await registeredVerify(req, res);
});

app.post("passwordless/authentication/options", async (req, res) => {
  await authenticateOptions(req, res);
});

app.post("passwordless/authentication/verify", async (req, res) => {
  await authenticateVerify(req, res);
});

app.post("biometric/registration", async (req, res) => {
  console.log("REQ BODY:", req.body);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  const users = loadUsers();
  console.log("USERS FROM FILE:", users);
});
