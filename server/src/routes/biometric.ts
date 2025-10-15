import { Router } from "express";
import { addUser, db, updateUser } from "../database.ts";
import { mapResponseQuery } from "../utils.ts";

const router = Router();

router.post("/registration", async (req, res) => {
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const { username, email, password, embedding, id, roleId } = req.body;
  if (usersFromDB.find((query: any) => query.username === username)) {
    return res.status(400).json({ error: "User already exists" });
  }
  // add only id, username, email, password, embedding, roleId
  addUser.run(
    id,
    username,
    email,
    "",
    "",
    password,
    roleId,
    "",
    "",
    embedding,
    ""
  );
  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ?"
    )
    .get(username);
  const response = mapResponseQuery(query);
  return res.status(200).json({ message: "Registration successful", response });
});

router.post("/authentication", async (req, res) => {
  console.log("authentication", req.body);
  const { username, password } = req.body;
  const query = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.id = users.roleId WHERE username = ? OR email = ? OR phoneNumber = ?"
    )
    .get(username, username, username);
  if (!query) {
    return res.status(400).json({ error: "User not found" });
  } else if (query.password !== password) {
    return res.status(400).json({ error: "Invalid password" });
  }
  const response = mapResponseQuery(query);
  return res.status(200).json({ response });
});

router.post("/change", async (req, res) => {
  const { username, embedding } = req.body;
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);
  if (!query) {
    return res.status(400).json({ error: "User not found" });
  }
  updateUser(query.id as number, { embedding: embedding });
  return res.status(200).json({ message: "Biometric changed successfully" });
});

router.post("/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);
  if (!query) {
    return res.status(400).json({ error: "User not found" });
  }
  if (query.password !== oldPassword) {
    return res.status(400).json({ error: "Invalid password" });
  }
  updateUser(query.id as number, { password: newPassword });
  return res.status(200).json({ message: "Password changed successfully" });
});

router.post("/confirm-password", async (req, res) => {
  const { username, password } = req.body;
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  const query = usersFromDB.find((q: any) => q.username === username);
  if (!query) {
    return res.status(400).json({ error: "User not found" });
  }
  if (query.password !== password) {
    return res.status(400).json({ error: "Invalid password" });
  }
  return res.status(200).json({ message: "Password confirmed successfully" });
});

export default router;
