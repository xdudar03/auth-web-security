import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("users.db");

const initTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT,
      embedding TEXT NOT NULL
    )
  `);
};

initTable();

const addUser = db.prepare(
  `INSERT INTO users (userId, username, password, embedding) VALUES (?, ?, ?, ?)`
);

const getUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`);

const getUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);

const updateUser = db.prepare(
  `UPDATE users SET username = ?, password = ?, embedding = ? WHERE id = ?`
);

const deleteUser = db.prepare(`DELETE FROM users WHERE id = ?`);

export { db, addUser, getUserByUsername, getUserById, updateUser, deleteUser };
