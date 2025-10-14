import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./users.db");

const initTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      embedding TEXT,
      credentials TEXT,
      roleId INTEGER NOT NULL,
      FOREIGN KEY (roleId) REFERENCES roles(id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roleName TEXT NOT NULL,
      canChangeUsersCredentials BOOLEAN NOT NULL,
      canChangeUsersRoles BOOLEAN NOT NULL,
      canReadUsers BOOLEAN NOT NULL,
      canReadUsersCredentials BOOLEAN NOT NULL,
      canReadUsersSettings BOOLEAN NOT NULL,
      canReadUsersRoles BOOLEAN NOT NULL,
      canAccessAdminPanel BOOLEAN NOT NULL,
      canAccessUserPanel BOOLEAN NOT NULL
    )
  `);
};

initTable();

const addUser = db.prepare(
  `INSERT INTO users (userId, username, password, embedding, roleId, credentials) VALUES (?, ?, ?, ?, ?, ?)` // credentials is a base64 string
);
// 1 is admin, 2 is user, 3 is shop owner
const addRole = db.prepare(
  `INSERT INTO roles (roleName, canChangeUsersCredentials, canChangeUsersRoles, canReadUsers, canReadUsersCredentials, canReadUsersSettings, canReadUsersRoles, canAccessAdminPanel, canAccessUserPanel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const getRoleById = db.prepare(`SELECT * FROM roles WHERE id = ?`);

const getRoleByName = db.prepare(`SELECT * FROM roles WHERE roleName = ?`);

const getUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`);

const getUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);

function updateUser(userId: number, updates: Record<string, any>) {
  const allowedFields = [
    "username",
    "password",
    "embedding",
    "roleId",
    "credentials", // credentials is a base64 string
  ];

  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`;
  values.push(userId);

  const stmt = db.prepare(sql);
  return stmt.run(...values);
}

const updateRole = db.prepare(
  `UPDATE roles SET roleName = ?, canChangeUsersCredentials = ?, canChangeUsersRoles = ?, canReadUsers = ?, canReadUsersCredentials = ?, canReadUsersSettings = ?, canReadUsersRoles = ?, canAccessAdminPanel = ?, canAccessUserPanel = ? WHERE id = ?`
);

const getRoles = db.prepare(`SELECT * FROM roles`);

const deleteUser = db.prepare(`DELETE FROM users WHERE id = ?`);

const deleteRole = db.prepare(`DELETE FROM roles WHERE id = ?`);

export {
  db,
  addUser,
  getUserByUsername,
  getUserById,
  updateUser,
  updateRole,
  deleteUser,
  addRole,
  getRoleById,
  getRoleByName,
  getRoles,
  deleteRole,
};
