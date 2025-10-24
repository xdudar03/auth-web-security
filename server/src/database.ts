import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./users.db");

const initTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      password TEXT NOT NULL,
      phoneNumber TEXT,
      dateOfBirth TEXT,
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
      canAccessUserPanel BOOLEAN NOT NULL,
      canAccessProviderPanel BOOLEAN NOT NULL,
      hasGlobalAccessToAllShops BOOLEAN NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopName TEXT NOT NULL,
    shopDescription TEXT,
    shopAddress TEXT,
    shopOwnerId TEXT NOT NULL,
    FOREIGN KEY (shopOwnerId) REFERENCES users(userId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_shops (
    userId TEXT NOT NULL,
    shopId INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (shopId) REFERENCES shops(id),
    PRIMARY KEY (userId, shopId)
    )
  `);
};

initTable();

const addUser = db.prepare(
  `INSERT INTO users (userId, username, email, firstName, lastName, password, roleId, phoneNumber, dateOfBirth, embedding, credentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` // credentials is a base64 string
);
// 1 is admin, 2 is user, 3 is shop owner
const addRole = db.prepare(
  `INSERT INTO roles (roleName, canChangeUsersCredentials, canChangeUsersRoles, canReadUsers, canReadUsersCredentials, canReadUsersSettings, canReadUsersRoles, canAccessAdminPanel, canAccessUserPanel, canAccessProviderPanel, hasGlobalAccessToAllShops) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const addShop = db.prepare(
  `INSERT INTO shops (shopName, shopDescription, shopAddress, shopOwnerId) VALUES (?, ?, ?, ?)`
);

const getShopById = db.prepare(`SELECT * FROM shops WHERE id = ?`);

const getShopByOwnerId = db.prepare(
  `SELECT * FROM shops WHERE shopOwnerId = ?`
);

const addUserToShop = db.prepare(
  `INSERT INTO user_shops (userId, shopId) VALUES (?, ?)`
);

const addShopOwnerToShop = db.prepare(
  `UPDATE shops SET shopOwnerId = ? WHERE id = ?`
);

const getUserShops = db.prepare(
  `SELECT shops.* FROM shops JOIN user_shops ON shops.id = user_shops.shopId WHERE user_shops.userId = ?`
);

const getShopUsers = db.prepare(
  `SELECT users.*, roles.roleName 
  FROM users 
  INNER JOIN user_shops ON users.userId = user_shops.userId 
  INNER JOIN roles ON roles.id = users.roleId
  INNER JOIN shops ON shops.id = user_shops.shopId
  WHERE user_shops.shopId = ?`
);

const getRoleById = db.prepare(`SELECT * FROM roles WHERE id = ?`);

const getRoleByName = db.prepare(`SELECT * FROM roles WHERE roleName = ?`);

const getUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`);

const getUserById = db.prepare(`SELECT * FROM users WHERE userId = ?`);

function updateUser(userId: string, updates: Record<string, any>) {
  const allowedFields = [
    "username",
    "email",
    "password",
    "firstName",
    "lastName",
    "phoneNumber",
    "dateOfBirth",
    "embedding",
    "credentials", // credentials is a base64 string
    "roleId",
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

  const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE userId = ?`;
  values.push(userId);

  const stmt = db.prepare(sql);
  return stmt.run(...values);
}

const updateRole = db.prepare(
  `UPDATE roles SET roleName = ?, canChangeUsersCredentials = ?, canChangeUsersRoles = ?, canReadUsers = ?, canReadUsersCredentials = ?, canReadUsersSettings = ?, canReadUsersRoles = ?, canAccessAdminPanel = ?, canAccessUserPanel = ?, canAccessProviderPanel = ?, hasGlobalAccessToAllShops = ? WHERE id = ?`
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
  addShop,
  getShopById,
  getShopByOwnerId,
  addUserToShop,
  getUserShops,
  getShopUsers,
  addShopOwnerToShop,
};
