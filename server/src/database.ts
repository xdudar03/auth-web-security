import { DatabaseSync } from "node:sqlite";
import { User } from "./types/user.ts";
import { Token } from "./types/token.ts";
import { Role } from "./types/role.ts";
import { Shop } from "./types/shop.ts";
import { UserShop } from "./types/userShop.ts";
import {
  PrivacySettings,
  PrivacySettingRecord,
} from "./types/privacySetting.ts";
import { Item } from "./types/item.ts";
import { Transaction } from "./types/transaction.ts";
import { TransactionItem } from "./types/transactionItem.ts";
import { UserTransaction } from "./types/userTransaction.ts";
import { Pseudonym } from "./types/pseudonym.ts";

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

type ReplaceUndefinedWithNull<T> = {
  [K in keyof Required<T>]:
    | Exclude<T[K], undefined>
    | (undefined extends T[K] ? null : never);
};

type X = ReplaceUndefinedWithNull<{ x?: number }>;

function mapUndefinedToNull<T extends Record<string, any>>(
  value: T
): ReplaceUndefinedWithNull<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      val === undefined ? null : val,
    ])
  ) as ReplaceUndefinedWithNull<T>;
}

const addUserQuery = db.prepare(
  `INSERT INTO users (userId, username, email, firstName, lastName, password, roleId, phoneNumber, dateOfBirth, gender, address, city, state, zip, country, spendings,  embedding, credentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` // credentials is a base64 string
);

const addUser = (user: User) => {
  const userWithoutUndefined = mapUndefinedToNull(user);
  addUserQuery.run(
    userWithoutUndefined.userId,
    userWithoutUndefined.username,
    userWithoutUndefined.email,
    userWithoutUndefined.firstName,
    userWithoutUndefined.lastName,
    userWithoutUndefined.password,
    userWithoutUndefined.roleId,
    userWithoutUndefined.phoneNumber,
    userWithoutUndefined.dateOfBirth,
    userWithoutUndefined.gender,
    userWithoutUndefined.address
    // userWithoutUndefined.city,
    // userWithoutUndefined.state,
    // userWithoutUndefined.zip,
    // userWithoutUndefined.country,
    // userWithoutUndefined.spendings,
    // userWithoutUndefined.embedding,
    // userWithoutUndefined.credentials
  );
};

// 1 is admin, 2 is user, 3 is shop owner
const addRoleQuery = db.prepare(
  `INSERT INTO roles (roleName, canChangeUsersCredentials, canChangeUsersRoles, canReadUsers, canReadUsersCredentials, canReadUsersSettings, canReadUsersRoles, canAccessAdminPanel, canAccessUserPanel, canAccessProviderPanel, hasGlobalAccessToAllShops) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const addUserPrivacyQuery = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`
);

const addShopQuery = db.prepare(
  `INSERT INTO shops (shopName, shopDescription, shopAddress, shopOwnerId) VALUES (?, ?, ?, ?)`
);

const addTokenQuery = db.prepare(
  `INSERT INTO tokens (token, expiresAt, purpose, userId) VALUES (?, ?, ?, ?)`
);

const getTokenQuery = db.prepare(
  `SELECT * FROM tokens WHERE token = ? AND purpose = ?`
);
const getToken = (tokenString: string, purpose: string) => {
  const tokenData = getTokenQuery.get(tokenString, purpose);
  const token = Token.parse(tokenData);
  return token;
};

const deleteTokenQuery = db.prepare(
  `DELETE FROM tokens WHERE token = ? AND purpose = ?`
);

const getShopByIdQuery = db.prepare(`SELECT * FROM shops WHERE shopId = ?`);

const getShopByOwnerIdQuery = db.prepare(
  `SELECT * FROM shops WHERE shopOwnerId = ?`
);

const getAllShopsQuery = db.prepare(`SELECT * FROM shops`);

const getUserPrivacyByUserIdQuery = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ?`
);

const getUserPrivacyByUserIdAndFieldQuery = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ? AND field = ?`
);

const updateUserPrivacyQuery = db.prepare(
  `UPDATE privacy_settings SET visibility = ? WHERE userId = ? AND field = ?`
);

const insertUserPrivacyQuery = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`
);

const addUserToShopQuery = db.prepare(
  `INSERT INTO user_shops (userId, shopId) VALUES (?, ?)`
);

const addShopOwnerToShopQuery = db.prepare(
  `UPDATE shops SET shopOwnerId = ? WHERE shopId = ?`
);

const getUserShopsQuery = db.prepare(
  `SELECT shops.* FROM shops JOIN user_shops ON shops.shopId = user_shops.shopId WHERE user_shops.userId = ?`
);

const getShopUsersQuery = db.prepare(
  `SELECT users.*, roles.roleName 
  FROM users 
  INNER JOIN user_shops ON users.userId = user_shops.userId 
  INNER JOIN roles ON roles.roleId = users.roleId
  INNER JOIN shops ON shops.shopId = user_shops.shopId
  WHERE user_shops.shopId = ?`
);

const getRoleByIdQuery = db.prepare(`SELECT * FROM roles WHERE roleId = ?`);

const getRoleByUserIdQuery = db.prepare(
  `SELECT * FROM roles WHERE roleId = (SELECT roleId FROM users WHERE userId = ?)`
);

const getRoleByNameQuery = db.prepare(`SELECT * FROM roles WHERE roleName = ?`);

const getUserByUsernameQuery = db.prepare(
  `SELECT * FROM users WHERE username = ?`
);

const getUserByIdQuery = db.prepare(`SELECT * FROM users WHERE userId = ?`);

function updateUserQuery(userId: string, updates: Record<string, any>) {
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

const updateRoleQuery = db.prepare(
  `UPDATE roles SET roleName = ?, canChangeUsersCredentials = ?, canChangeUsersRoles = ?, canReadUsers = ?, canReadUsersCredentials = ?, canReadUsersSettings = ?, canReadUsersRoles = ?, canAccessAdminPanel = ?, canAccessUserPanel = ?, canAccessProviderPanel = ?, hasGlobalAccessToAllShops = ? WHERE roleId = ?`
);

const getRolesQuery = db.prepare(`SELECT * FROM roles`);

const deleteUserQuery = db.prepare(`DELETE FROM users WHERE userId = ?`);

const deleteRoleQuery = db.prepare(`DELETE FROM roles WHERE roleId = ?`);

// Items, transactions, and pseudonyms helpers
const addItemQuery = db.prepare(
  `INSERT INTO items (itemName, itemPrice, shopId) VALUES (?, ?, ?)`
);

const getItemByNameAndShopQuery = db.prepare(
  `SELECT * FROM items WHERE itemName = ? AND shopId = ?`
);

const addTransactionQuery = db.prepare(
  `INSERT INTO transactions (shopId, pseudoId, totalPrice, location, paymentMethod, purchaseType) VALUES (?, ?, ?, ?, ?, ?)`
);

const addTransactionItemQuery = db.prepare(
  `INSERT INTO transaction_items (transactionId, itemId, quantity) VALUES (?, ?, ?)`
);

const linkUserTransactionQuery = db.prepare(
  `INSERT INTO user_transactions (userId, transactionId) VALUES (?, ?)`
);

const addPseudonymQuery = db.prepare(
  `INSERT INTO pseudonyms (pseudoId, userId, expiresAt) VALUES (?, ?, ?)`
);

const getLastInsertRowIdQuery = db.prepare(`SELECT last_insert_rowid() as id`);

const getTransactionsByUserIdQuery = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.pseudoId = ?`
);

const getTransactionsByShopIdQuery = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.shopId = ?`
);

const getTransactionByTransactionIdQuery = db.prepare(
  `SELECT * FROM transactions WHERE transactionId = ?`
);

const getTransactionItemsByTransactionIdQuery = db.prepare(
  `SELECT * FROM transaction_items WHERE transactionId = ?`
);

const getUserTransactionsByUserIdQuery = db.prepare(
  `SELECT * FROM user_transactions WHERE userId = ?`
);

const getUserTransactionsByTransactionIdQuery = db.prepare(
  `SELECT * FROM user_transactions WHERE transactionId = ?`
);

const getPseudonymByUserIdQuery = db.prepare(
  `SELECT * FROM pseudonyms WHERE userId = ?`
);

const getUserIdByPseudoIdQuery = db.prepare(
  `SELECT userId FROM pseudonyms WHERE pseudoId = ?`
);

const getUserPrivacyFieldByUserIdQuery = db.prepare(
  `SELECT visibility FROM privacy_settings WHERE userId = ? AND field = ?`
);

const getUserWithRoleQuery = db.prepare(
  `SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE users.userId = ?`
);

// User queries
const getUserByUsername = (username: string) => {
  const userData = getUserByUsernameQuery.get(username);
  return User.parse(userData);
};

const getUserById = (userId: string) => {
  const userData = getUserByIdQuery.get(userId);
  return User.parse(userData);
};

const deleteUser = (userId: string) => {
  deleteUserQuery.run(userId);
};

const updateUser = (userId: string, updates: Partial<User>) => {
  updateUserQuery(userId, updates);
};

const getAllUsersQuery = db.prepare(`SELECT * FROM users`);
const getAllUsers = () => {
  const usersData = getAllUsersQuery.all();
  return usersData.map((user) => User.parse(user));
};

const getUserForAuthenticationQuery = db.prepare(
  `SELECT * FROM users WHERE username = ? OR email = ? OR phoneNumber = ?`
);

const getUserForAuthentication = (
  username: string,
  email: string,
  phoneNumber: string
) => {
  const userData = getUserForAuthenticationQuery.get(
    username,
    email,
    phoneNumber
  );
  return User.parse(userData);
};

// Role queries
const addRole = (role: Role) => {
  addRoleQuery.run(
    role.roleName,
    role.canChangeUsersCredentials ? 1 : 0,
    role.canChangeUsersRoles ? 1 : 0,
    role.canReadUsers ? 1 : 0,
    role.canReadUsersCredentials ? 1 : 0,
    role.canReadUsersSettings ? 1 : 0,
    role.canReadUsersRoles ? 1 : 0,
    role.canAccessAdminPanel ? 1 : 0,
    role.canAccessUserPanel ? 1 : 0,
    role.canAccessProviderPanel ? 1 : 0,
    role.hasGlobalAccessToAllShops ? 1 : 0
  );
};

const getRoleById = (roleId: number) => {
  const roleData = getRoleByIdQuery.get(roleId);
  return Role.parse(roleData);
};

const getRoleByUserId = (userId: string) => {
  const roleData = getRoleByUserIdQuery.get(userId);
  return Role.parse(roleData);
};

const getRoleByName = (roleName: string) => {
  const roleData = getRoleByNameQuery.get(roleName);
  return Role.parse(roleData);
};

const getRoles = () => {
  const rolesData = getRolesQuery.all();
  return rolesData.map((role) => Role.parse(role));
};

const updateRole = (roleId: number, role: Role) => {
  updateRoleQuery.run(
    role.roleName,
    role.canChangeUsersCredentials ? 1 : 0,
    role.canChangeUsersRoles ? 1 : 0,
    role.canReadUsers ? 1 : 0,
    role.canReadUsersCredentials ? 1 : 0,
    role.canReadUsersSettings ? 1 : 0,
    role.canReadUsersRoles ? 1 : 0,
    role.canAccessAdminPanel ? 1 : 0,
    role.canAccessUserPanel ? 1 : 0,
    role.canAccessProviderPanel ? 1 : 0,
    role.hasGlobalAccessToAllShops ? 1 : 0,
    roleId
  );
};

const deleteRole = (roleId: number) => {
  deleteRoleQuery.run(roleId);
};

// Shop queries
const addShop = (shop: Omit<Shop, "shopId">) => {
  const shopWithoutId = mapUndefinedToNull(shop);
  addShopQuery.run(
    shopWithoutId.shopName,
    shopWithoutId.shopDescription,
    shopWithoutId.shopAddress,
    shopWithoutId.shopOwnerId
  );
};

const getShopById = (shopId: number) => {
  const shopData = getShopByIdQuery.get(shopId);
  return Shop.parse(shopData);
};

const getAllShops = () => {
  const shopsData = getAllShopsQuery.all();
  return shopsData.map((shop) => Shop.parse(shop));
};

const getShopByOwnerId = (ownerId: string) => {
  const shopData = getShopByOwnerIdQuery.get(ownerId);
  return Shop.parse(shopData);
};

const addShopOwnerToShop = (shopId: number, ownerId: string) => {
  addShopOwnerToShopQuery.run(ownerId, shopId);
};

// User Shop queries
const addUserToShop = (userId: string, shopId: number) => {
  return addUserToShopQuery.run(userId, shopId);
};

const getUserShops = (userId: string) => {
  const shopsData = getUserShopsQuery.all(userId);
  return shopsData.map((shop) => Shop.parse(shop));
};

const getShopUsers = (shopId: number) => {
  const usersData = getShopUsersQuery.all(shopId);
  return usersData.map((user) => User.parse(user));
};

// Token queries
const addToken = (token: Token) => {
  const tokenWithoutId = mapUndefinedToNull(token);
  return addTokenQuery.run(
    tokenWithoutId.token,
    tokenWithoutId.expiresAt,
    tokenWithoutId.purpose,
    tokenWithoutId.userId
  );
};

const deleteToken = (token: string, purpose: string) => {
  deleteTokenQuery.run(token, purpose);
};

// Privacy Settings queries
const addUserPrivacy = (
  privacySetting: Omit<PrivacySettingRecord, "privacyId">
) => {
  const settingWithoutId = mapUndefinedToNull(privacySetting);
  addUserPrivacyQuery.run(
    settingWithoutId.userId,
    settingWithoutId.field,
    settingWithoutId.visibility
  );
};

const getUserPrivacyByUserId = (userId: string) => {
  const privacyData = getUserPrivacyByUserIdQuery.all(userId);
  return privacyData.map((privacy) => PrivacySettings.parse(privacy));
};

const getUserPrivacyByUserIdAndField = (userId: string, field: string) => {
  const privacyData = getUserPrivacyByUserIdAndFieldQuery.get(userId, field);
  return PrivacySettings.parse(privacyData);
};

const updateUserPrivacy = (
  userId: string,
  field: string,
  visibility: string
) => {
  return updateUserPrivacyQuery.run(visibility, userId, field);
};

const insertUserPrivacy = (
  privacySetting: Omit<PrivacySettingRecord, "privacyId">
) => {
  const settingWithoutId = mapUndefinedToNull(privacySetting);
  return insertUserPrivacyQuery.run(
    settingWithoutId.userId,
    settingWithoutId.field,
    settingWithoutId.visibility
  );
};

const getUserPrivacyFieldByUserId = (userId: string, field: string) => {
  const privacyData = getUserPrivacyFieldByUserIdQuery.get(userId, field);
  return privacyData;
};

// Item queries
const addItem = (item: Omit<Item, "itemId">) => {
  const itemWithoutId = mapUndefinedToNull(item);
  addItemQuery.run(
    itemWithoutId.itemName,
    itemWithoutId.itemPrice,
    itemWithoutId.shopId
  );
};

const getItemByNameAndShop = (itemName: string, shopId: number) => {
  const itemData = getItemByNameAndShopQuery.get(itemName, shopId);
  return Item.parse(itemData);
};

// Transaction queries
const addTransaction = (transaction: Omit<Transaction, "transactionId">) => {
  const transactionWithoutId = mapUndefinedToNull(transaction);
  addTransactionQuery.run(
    transactionWithoutId.shopId,
    transactionWithoutId.pseudoId,
    transactionWithoutId.totalPrice,
    transactionWithoutId.location,
    transactionWithoutId.paymentMethod,
    transactionWithoutId.purchaseType
  );
};

const getTransactionByTransactionId = (transactionId: number) => {
  const transactionData = getTransactionByTransactionIdQuery.get(transactionId);
  return Transaction.parse(transactionData);
};

const getTransactionsByUserId = (pseudoId: string) => {
  const transactionsData = getTransactionsByUserIdQuery.all(pseudoId);
  return transactionsData.map((transaction) => Transaction.parse(transaction));
};

const getTransactionsByShopId = (shopId: number) => {
  const transactionsData = getTransactionsByShopIdQuery.all(shopId);
  return transactionsData.map((transaction) => Transaction.parse(transaction));
};

// Transaction Item queries
const addTransactionItem = (transactionItem: TransactionItem) => {
  const itemWithoutAutoId = mapUndefinedToNull(transactionItem);
  addTransactionItemQuery.run(
    itemWithoutAutoId.transactionId,
    itemWithoutAutoId.itemId,
    itemWithoutAutoId.quantity
  );
};

const getTransactionItemsByTransactionId = (transactionId: number) => {
  const itemsData = getTransactionItemsByTransactionIdQuery.all(transactionId);
  return itemsData.map((item) => TransactionItem.parse(item));
};

// User Transaction queries
const linkUserTransaction = (userId: string, transactionId: number) => {
  linkUserTransactionQuery.run(userId, transactionId);
};

const getUserTransactionsByUserId = (userId: string) => {
  const userTransactionsData = getUserTransactionsByUserIdQuery.all(userId);
  return userTransactionsData.map((ut) => UserTransaction.parse(ut));
};

const getUserTransactionsByTransactionId = (transactionId: number) => {
  const userTransactionsData =
    getUserTransactionsByTransactionIdQuery.all(transactionId);
  return userTransactionsData.map((ut) => UserTransaction.parse(ut));
};

// Pseudonym queries
const addPseudonym = (pseudonym: Pseudonym) => {
  const pseudonymData = mapUndefinedToNull(pseudonym);
  addPseudonymQuery.run(
    pseudonymData.pseudoId,
    pseudonymData.userId,
    pseudonymData.expiresAt
  );
};

const getPseudonymByUserId = (userId: string) => {
  const pseudonymData = getPseudonymByUserIdQuery.get(userId);
  return Pseudonym.parse(pseudonymData);
};

const getUserIdByPseudoId = (pseudoId: string) => {
  const data = getUserIdByPseudoIdQuery.get(pseudoId);
  return data?.userId as string | undefined;
};

// Utility queries
const getLastInsertRowId = () => {
  const result = getLastInsertRowIdQuery.get();
  return result ? result.id : null;
};

export {
  db,
  addUser,
  getAllUsers,
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
  getUserWithRoleQuery,
  getAllShops,
  getUserForAuthentication,
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
