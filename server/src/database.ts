import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./users.db");
// TODO: change shoppingHistory and spendings
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
      roleId INTEGER NOT NULL,
      phoneNumber TEXT,
      dateOfBirth TEXT,
      gender TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      country TEXT,
      spendings TEXT,
      embedding TEXT,
      credentials TEXT,
      FOREIGN KEY (roleId) REFERENCES roles(roleId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      roleId INTEGER PRIMARY KEY AUTOINCREMENT,
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
    shopId INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (shopId) REFERENCES shops(shopId),
    PRIMARY KEY (userId, shopId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
    token TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    purpose TEXT NOT NULL,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(userId),
    PRIMARY KEY (token, userId, purpose)
    )
  `);
  // the options for privacy settings are: show nothing, show some of it, show anonymized data and show all data
  db.exec(` 
    CREATE TABLE IF NOT EXISTS privacy_settings (
      privacyId INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      field TEXT NOT NULL,             -- e.g. 'email', 'address', 'gender'
      visibility TEXT NOT NULL,        -- 'hidden' | 'anonymized' | 'visible'
      FOREIGN KEY (userId) REFERENCES users(userId),
      UNIQUE (userId, field)
    )
    `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pseudonyms (
      pseudoId TEXT PRIMARY KEY,          -- random unique token (UUID)
      userId TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      expiresAt TEXT,                     -- optional for rotating pseudonyms
      FOREIGN KEY (userId) REFERENCES users(userId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      itemId INTEGER PRIMARY KEY AUTOINCREMENT,
      itemName TEXT NOT NULL,
      itemPrice REAL NOT NULL,
      shopId INTEGER NOT NULL,
      FOREIGN KEY (shopId) REFERENCES shops(shopId),
      UNIQUE (itemName, shopId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      transactionId INTEGER PRIMARY KEY AUTOINCREMENT,
      shopId INTEGER NOT NULL,
      pseudoId TEXT,                      -- nullable: transaction may be anonymous
      totalPrice REAL NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      paymentMethod TEXT NOT NULL CHECK (paymentMethod IN ('cash','card','apple_pay','google_pay','bank_transfer','other')),
      purchaseType TEXT NOT NULL CHECK (purchaseType IN ('in_store','online')),
      FOREIGN KEY (pseudoId) REFERENCES pseudonyms(pseudoId),
      FOREIGN KEY (shopId) REFERENCES shops(shopId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      transactionId INTEGER NOT NULL,
      itemId INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (transactionId) REFERENCES transactions(transactionId),
      FOREIGN KEY (itemId) REFERENCES items(itemId),
      PRIMARY KEY (transactionId, itemId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_transactions (
      userId TEXT NOT NULL,
      transactionId INTEGER NOT NULL,
      linkedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(userId),
      FOREIGN KEY (transactionId) REFERENCES transactions(transactionId),
      UNIQUE (userId, transactionId)
    )
    `);
};

initTable();

const addUser = db.prepare(
  `INSERT INTO users (userId, username, email, firstName, lastName, password, roleId, phoneNumber, dateOfBirth, gender, address, city, state, zip, country, spendings,  embedding, credentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` // credentials is a base64 string
);
// 1 is admin, 2 is user, 3 is shop owner
const addRole = db.prepare(
  `INSERT INTO roles (roleName, canChangeUsersCredentials, canChangeUsersRoles, canReadUsers, canReadUsersCredentials, canReadUsersSettings, canReadUsersRoles, canAccessAdminPanel, canAccessUserPanel, canAccessProviderPanel, hasGlobalAccessToAllShops) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const addUserPrivacy = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`
);

const addShop = db.prepare(
  `INSERT INTO shops (shopName, shopDescription, shopAddress, shopOwnerId) VALUES (?, ?, ?, ?)`
);

const addToken = db.prepare(
  `INSERT INTO tokens (token, expiresAt, purpose, userId) VALUES (?, ?, ?, ?)`
);

const getToken = db.prepare(
  `SELECT * FROM tokens WHERE token = ? AND purpose = ?`
);

const deleteToken = db.prepare(
  `DELETE FROM tokens WHERE token = ? AND purpose = ?`
);

const getShopById = db.prepare(`SELECT * FROM shops WHERE shopId = ?`);

const getShopByOwnerId = db.prepare(
  `SELECT * FROM shops WHERE shopOwnerId = ?`
);

const getUserPrivacyByUserId = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ?`
);

const getUserPrivacyByUserIdAndField = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ? AND field = ?`
);

const updateUserPrivacy = db.prepare(
  `UPDATE privacy_settings SET visibility = ? WHERE userId = ? AND field = ?`
);

const insertUserPrivacy = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`
);

const addUserToShop = db.prepare(
  `INSERT INTO user_shops (userId, shopId) VALUES (?, ?)`
);

const addShopOwnerToShop = db.prepare(
  `UPDATE shops SET shopOwnerId = ? WHERE shopId = ?`
);

const getUserShops = db.prepare(
  `SELECT shops.* FROM shops JOIN user_shops ON shops.shopId = user_shops.shopId WHERE user_shops.userId = ?`
);

const getShopUsers = db.prepare(
  `SELECT users.*, roles.roleName 
  FROM users 
  INNER JOIN user_shops ON users.userId = user_shops.userId 
  INNER JOIN roles ON roles.roleId = users.roleId
  INNER JOIN shops ON shops.shopId = user_shops.shopId
  WHERE user_shops.shopId = ?`
);

const getRoleById = db.prepare(`SELECT * FROM roles WHERE roleId = ?`);

const getRoleByUserId = db.prepare(
  `SELECT * FROM roles WHERE roleId = (SELECT roleId FROM users WHERE userId = ?)`
);

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
    "credentials",
    "roleId",
    "gender",
    "address",
    "city",
    "state",
    "zip",
    "country",
    "spendings",
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
  `UPDATE roles SET roleName = ?, canChangeUsersCredentials = ?, canChangeUsersRoles = ?, canReadUsers = ?, canReadUsersCredentials = ?, canReadUsersSettings = ?, canReadUsersRoles = ?, canAccessAdminPanel = ?, canAccessUserPanel = ?, canAccessProviderPanel = ?, hasGlobalAccessToAllShops = ? WHERE roleId = ?`
);

const getRoles = db.prepare(`SELECT * FROM roles`);

const deleteUser = db.prepare(`DELETE FROM users WHERE userId = ?`);

const deleteRole = db.prepare(`DELETE FROM roles WHERE roleId = ?`);

// Items, transactions, and pseudonyms helpers
const addItem = db.prepare(
  `INSERT INTO items (itemName, itemPrice, shopId) VALUES (?, ?, ?)`
);

const getItemByNameAndShop = db.prepare(
  `SELECT * FROM items WHERE itemName = ? AND shopId = ?`
);

const addTransaction = db.prepare(
  `INSERT INTO transactions (shopId, pseudoId, totalPrice, location, paymentMethod, purchaseType) VALUES (?, ?, ?, ?, ?, ?)`
);

const addTransactionItem = db.prepare(
  `INSERT INTO transaction_items (transactionId, itemId, quantity) VALUES (?, ?, ?)`
);

const linkUserTransaction = db.prepare(
  `INSERT INTO user_transactions (userId, transactionId) VALUES (?, ?)`
);

const addPseudonym = db.prepare(
  `INSERT INTO pseudonyms (pseudoId, userId, expiresAt) VALUES (?, ?, ?)`
);

const getLastInsertRowId = db.prepare(`SELECT last_insert_rowid() as id`);

const getTransactionsByUserId = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.pseudoId = ?`
);

const getTransactionsByShopId = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.shopId = ?`
);

const getTransactionByTransactionId = db.prepare(
  `SELECT * FROM transactions WHERE transactionId = ?`
);

const getTransactionItemsByTransactionId = db.prepare(
  `SELECT * FROM transaction_items WHERE transactionId = ?`
);

const getUserTransactionsByUserId = db.prepare(
  `SELECT * FROM user_transactions WHERE userId = ?`
);

const getUserTransactionsByTransactionId = db.prepare(
  `SELECT * FROM user_transactions WHERE transactionId = ?`
);

const getPseudonymByUserId = db.prepare(
  `SELECT * FROM pseudonyms WHERE userId = ?`
);

const getUserIdByPseudoId = db.prepare(
  `SELECT userId FROM pseudonyms WHERE pseudoId = ?`
);

const getUserPrivacyFieldByUserId = db.prepare(
  `SELECT visibility FROM privacy_settings WHERE userId = ? AND field = ?`
);

export {
  db,
  addUser,
  getUserByUsername,
  getUserById,
  getRoleByUserId,
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
  addToken,
  getToken,
  deleteToken,
  addUserPrivacy,
  getUserPrivacyByUserId,
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
  addItem,
  getItemByNameAndShop,
  addTransaction,
  addTransactionItem,
  linkUserTransaction,
  addPseudonym,
  getLastInsertRowId,
  getTransactionsByUserId,
  getTransactionsByShopId,
  getTransactionByTransactionId,
  getTransactionItemsByTransactionId,
  getUserTransactionsByUserId,
  getUserTransactionsByTransactionId,
  getPseudonymByUserId,
  getUserIdByPseudoId,
  getUserPrivacyFieldByUserId,
};
