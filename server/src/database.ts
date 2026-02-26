import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { User, UserPrivateData } from "./types/user.ts";
import { Token } from "./types/token.ts";
import { Role } from "./types/role.ts";
import { Shop } from "./types/shop.ts";
import { Embedding } from "./types/model.ts";
import { Statistic } from "./types/statistics.ts";
import {
  PrivacySettings,
  PrivacySettingRecord,
} from "./types/privacySetting.ts";
import { Item } from "./types/item.ts";
import { Transaction } from "./types/transaction.ts";
import { TransactionItem } from "./types/transactionItem.ts";
import { UserTransaction } from "./types/userTransaction.ts";
import { Pseudonym } from "./types/pseudonym.ts";
import { Customer } from "./types/customer.ts";

const rawDbPath = process.env.SQLITE_DB_PATH?.trim() || "./data/users.db";
const dbPath = isAbsolute(rawDbPath)
  ? rawDbPath
  : resolve(process.cwd(), rawDbPath);

console.log("dbPath", dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
// TODO: change shoppingHistory and spendings
const initTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL UNIQUE,
      hpkePublicKeyB64 TEXT,
      dekB64 TEXT,
      emailHash TEXT UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      roleId INTEGER NOT NULL,
      isBiometric BOOLEAN NOT NULL DEFAULT FALSE,
      credentials TEXT,
      privacyPreset TEXT,
      FOREIGN KEY (roleId) REFERENCES roles(roleId)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_private_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL UNIQUE,
    original_cipher BLOB ,
    original_iv BLOB,
    original_version INTEGER NOT NULL DEFAULT 1,  
    original_aad BLOB,
  
    anonymized_cipher BLOB,
    anonymized_iv BLOB,
    anonymized_aad BLOB,
    anonymized_version INTEGER NOT NULL DEFAULT 1,
    
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId)
  )`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      customerId TEXT NOT NULL UNIQUE,
      isBiometric BOOLEAN NOT NULL
    )
  `);
  db.exec(`
      CREATE TABLE IF NOT EXISTS user_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        customerId TEXT,
        embedding TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(userId),
        FOREIGN KEY (customerId) REFERENCES customers(customerId),
        CHECK (
          (userId IS NOT NULL AND customerId IS NULL) OR 
          (userId IS NULL AND customerId IS NOT NULL)
        )
      )
    `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopId INTEGER NOT NULL,
    userId TEXT,
    customerId TEXT,
    visitAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shopId) REFERENCES shops(shopId),
    FOREIGN KEY (userId) REFERENCES users(userId),
    FOREIGN KEY (customerId) REFERENCES customers(customerId),
    CHECK (
      (userId IS NOT NULL AND customerId IS NULL) OR
      (userId IS NULL AND customerId IS NOT NULL)
    )
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
      userId TEXT,
      customerId TEXT,
      shopId INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(userId),
      FOREIGN KEY (shopId) REFERENCES shops(shopId),
      FOREIGN KEY (customerId) REFERENCES customers(customerId),
      PRIMARY KEY (userId, customerId, shopId),
      CHECK (
        (userId IS NOT NULL AND customerId IS NULL) OR 
        (userId IS NULL AND customerId IS NOT NULL)
      )
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

const ensureUsersColumns = () => {
  const columns = db
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("hpkePublicKeyB64")) {
    db.exec("ALTER TABLE users ADD COLUMN hpkePublicKeyB64 TEXT");
  }
};

ensureUsersColumns();

type ReplaceUndefinedWithNull<T> = {
  [K in keyof Required<T>]:
    | Exclude<T[K], undefined>
    | (undefined extends T[K] ? null : never);
};

type X = ReplaceUndefinedWithNull<{ x?: number }>;

function mapUndefinedToNull<T extends Record<string, any>>(
  value: T,
): ReplaceUndefinedWithNull<T> {
  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      val === undefined ? null : val,
    ]),
  );

  // This is a proxy to ensure that undefined values are converted to null
  const proxy = new Proxy(normalized, {
    get(target, prop: string) {
      if (prop in target) {
        const v = (target as any)[prop];
        return v === undefined ? null : v;
      }
      return null;
    },
  });

  return proxy as ReplaceUndefinedWithNull<T>;
}

const addUserQuery = db.prepare(
  `INSERT INTO users (userId, hpkePublicKeyB64, dekB64, emailHash, username, password, roleId, isBiometric, credentials, privacyPreset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const addUser = (user: User) => {
  const userWithoutUndefined = mapUndefinedToNull(user);
  const biometricFlag = userWithoutUndefined.isBiometric ? 1 : 0;
  addUserQuery.run(
    userWithoutUndefined.userId,
    userWithoutUndefined.hpkePublicKeyB64,
    userWithoutUndefined.dekB64,
    userWithoutUndefined.emailHash,
    userWithoutUndefined.username,
    userWithoutUndefined.password,
    userWithoutUndefined.roleId,
    biometricFlag,
    userWithoutUndefined.credentials,
    userWithoutUndefined.privacyPreset,
  );
};

// 1 is admin, 2 is user, 3 is shop owner
const addRoleQuery = db.prepare(
  `INSERT INTO roles (roleName, canChangeUsersCredentials, canChangeUsersRoles, canReadUsers, canReadUsersCredentials, canReadUsersSettings, canReadUsersRoles, canAccessAdminPanel, canAccessUserPanel, canAccessProviderPanel, hasGlobalAccessToAllShops) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const addUserPrivacyQuery = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`,
);

const addShopQuery = db.prepare(
  `INSERT INTO shops (shopName, shopDescription, shopAddress, shopOwnerId) VALUES (?, ?, ?, ?)`,
);

const addTokenQuery = db.prepare(
  `INSERT INTO tokens (token, expiresAt, purpose, userId) VALUES (?, ?, ?, ?)`,
);

const getTokenQuery = db.prepare(
  `SELECT * FROM tokens WHERE token = ? AND purpose = ?`,
);
const getToken = (tokenString: string, purpose: string) => {
  const tokenData = getTokenQuery.get(tokenString, purpose);
  const result = Token.safeParse(tokenData);
  if (!result.success) {
    console.error("Parse error in getToken:", result.error);
    return null;
  }
  return result.data;
};

const deleteTokenQuery = db.prepare(
  `DELETE FROM tokens WHERE token = ? AND purpose = ?`,
);

const getShopByIdQuery = db.prepare(`SELECT * FROM shops WHERE shopId = ?`);

const getShopByOwnerIdQuery = db.prepare(
  `SELECT * FROM shops WHERE shopOwnerId = ?`,
);

const getAllShopsQuery = db.prepare(`SELECT * FROM shops`);

const getUserPrivacyByUserIdQuery = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ?`,
);

const getUserPrivacyByUserIdAndFieldQuery = db.prepare(
  `SELECT field, visibility FROM privacy_settings WHERE userId = ? AND field = ?`,
);

const updateUserPrivacyQuery = db.prepare(
  `UPDATE privacy_settings SET visibility = ? WHERE userId = ? AND field = ?`,
);

const insertUserPrivacyQuery = db.prepare(
  `INSERT INTO privacy_settings (userId, field, visibility) VALUES (?, ?, ?)`,
);

const addUserToShopQuery = db.prepare(
  `INSERT INTO user_shops (userId, shopId) VALUES (?, ?)`,
);

const addCustomerToShopQuery = db.prepare(
  `INSERT INTO user_shops (customerId, shopId) VALUES (?, ?)`,
);

const addCustomerToShop = (customerId: string, shopId: number) => {
  addCustomerToShopQuery.run(customerId, shopId);
};

const addShopOwnerToShopQuery = db.prepare(
  `UPDATE shops SET shopOwnerId = ? WHERE shopId = ?`,
);

const getUserShopsQuery = db.prepare(
  `SELECT shops.* FROM shops JOIN user_shops ON shops.shopId = user_shops.shopId WHERE user_shops.userId = ?`,
);

const getShopUsersQuery = db.prepare(
  `SELECT
    users.userId,
    users.username,
    users.hpkePublicKeyB64,
    users.dekB64,
    users.password,
    users.roleId,
    users.credentials,
    NULL AS email,
    NULL AS firstName,
    NULL AS lastName,
    users.isBiometric,
    NULL AS phoneNumber,
    NULL AS dateOfBirth,
    NULL AS gender,
    NULL AS address,
    NULL AS city,
    NULL AS state,
    NULL AS zip,
    NULL AS country,
    NULL AS spendings,
    users.privacyPreset,
    roles.roleName,
    1 AS registered
  FROM users
  INNER JOIN user_shops ON users.userId = user_shops.userId
  INNER JOIN roles ON roles.roleId = users.roleId
  WHERE user_shops.shopId = ?

  UNION ALL

  SELECT
    customers.customerId AS userId,
    customers.customerId AS username,
    NULL AS hpkePublicKeyB64,
    NULL AS dekB64,
    '' AS password,
    NULL AS roleId,
    NULL AS credentials,
    '' AS email,
    NULL AS firstName,
    NULL AS lastName,
    customers.isBiometric AS isBiometric,
    NULL AS phoneNumber,
    NULL AS dateOfBirth,
    NULL AS gender,
    NULL AS address,
    NULL AS city,
    NULL AS state,
    NULL AS zip,
    NULL AS country,
    NULL AS spendings,
    NULL AS privacyPreset,
    'customer' AS roleName,
    0 AS registered
  FROM customers
  INNER JOIN user_shops ON customers.customerId = user_shops.customerId
  WHERE user_shops.shopId = ?`,
);

const getRoleByIdQuery = db.prepare(`SELECT * FROM roles WHERE roleId = ?`);

const getRoleByUserIdQuery = db.prepare(
  `SELECT * FROM roles WHERE roleId = (SELECT roleId FROM users WHERE userId = ?)`,
);

const getRoleByNameQuery = db.prepare(`SELECT * FROM roles WHERE roleName = ?`);

const getUserByUsernameQuery = db.prepare(
  `SELECT * FROM users WHERE username = ?`,
);

const getUserPrivacyPresetQuery = db.prepare(
  `SELECT privacyPreset FROM users WHERE userId = ?`,
);

const getUserPrivacyPresetById = (userId: string) => {
  const userData = getUserPrivacyPresetQuery.get(userId);
  console.log("userData", userData);
  return userData?.privacyPreset;
};

const getUserByIdQuery = db.prepare(`SELECT * FROM users WHERE userId = ?`);

const getUserByEmailHashQuery = db.prepare(
  `SELECT * FROM users WHERE emailHash = ?`,
);

const getUserPrivateDataByUserIdQuery = db.prepare(
  `SELECT * FROM user_private_data WHERE userId = ?`,
);

function updateUserQuery(userId: string, updates: Record<string, any>) {
  const allowedFields = [
    "username",
    "hpkePublicKeyB64",
    "emailHash",
    "dekB64",
    "password",
    "firstName",
    "lastName",
    "isBiometric",
    "phoneNumber",
    "dateOfBirth",
    "credentials",
    "roleId",
    "gender",
    "address",
    "city",
    "state",
    "zip",
    "country",
    "spendings",
    "privacyPreset",
  ];

  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClauses.push(`${key} = ?`);
      // Normalize values so SQLite can bind them safely.
      if (typeof value === "boolean") {
        values.push(value ? 1 : 0);
      } else if (typeof value === "object" && value !== null) {
        // Convert arrays/objects to JSON strings for SQLite storage.
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  }

  if (setClauses.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE userId = ?`;
  values.push(userId);

  const stmt = db.prepare(sql);
  const result = stmt.run(...values);
  return result;
}

const addCustomerEmbeddingQuery = db.prepare(
  `INSERT INTO user_embeddings (customerId, embedding) VALUES (?, ?)`,
);

const addCustomerEmbedding = (customerId: string, embedding: string) => {
  addCustomerEmbeddingQuery.run(customerId, embedding);
};

const addUserEmbeddingQuery = db.prepare(
  `INSERT INTO user_embeddings (userId, embedding) VALUES (?, ?)`,
);

const addUserEmbedding = (userId: string, embedding: string) => {
  addUserEmbeddingQuery.run(userId, embedding);
};

const getUserEmbeddingsByUserIdQuery = db.prepare(
  `SELECT embedding FROM user_embeddings WHERE userId = ?`,
);

const getUserEmbeddingsByUserId = (userId: string) => {
  const embeddingsData = getUserEmbeddingsByUserIdQuery.all(userId);
  return embeddingsData.map((embedding) => embedding.embedding);
};

const getAllEmbeddingsQuery = db.prepare(`SELECT * FROM user_embeddings`);

const getAllEmbeddings = () => {
  const embeddingsData = getAllEmbeddingsQuery.all();
  // return [{userId: string, embedding: string}]
  return embeddingsData
    .map((userEmbedding) => ({
      userId: userEmbedding.userId,
      embedding: userEmbedding.embedding,
    }))
    .filter((userEmbedding) => userEmbedding !== null);
};

const updateRoleQuery = db.prepare(
  `UPDATE roles SET roleName = ?, canChangeUsersCredentials = ?, canChangeUsersRoles = ?, canReadUsers = ?, canReadUsersCredentials = ?, canReadUsersSettings = ?, canReadUsersRoles = ?, canAccessAdminPanel = ?, canAccessUserPanel = ?, canAccessProviderPanel = ?, hasGlobalAccessToAllShops = ? WHERE roleId = ?`,
);

const getRolesQuery = db.prepare(`SELECT * FROM roles`);

const deleteUserQuery = db.prepare(`DELETE FROM users WHERE userId = ?`);

const deleteRoleQuery = db.prepare(`DELETE FROM roles WHERE roleId = ?`);

// Items, transactions, and pseudonyms helpers
const addItemQuery = db.prepare(
  `INSERT INTO items (itemName, itemPrice, shopId) VALUES (?, ?, ?)`,
);

const getItemByNameAndShopQuery = db.prepare(
  `SELECT * FROM items WHERE itemName = ? AND shopId = ?`,
);

const addTransactionQuery = db.prepare(
  `INSERT INTO transactions (shopId, pseudoId, totalPrice, location, paymentMethod, purchaseType) VALUES (?, ?, ?, ?, ?, ?)`,
);

const addTransactionItemQuery = db.prepare(
  `INSERT INTO transaction_items (transactionId, itemId, quantity) VALUES (?, ?, ?)`,
);

const linkUserTransactionQuery = db.prepare(
  `INSERT INTO user_transactions (userId, transactionId) VALUES (?, ?)`,
);

const getUserIdByUsernameQuery = db.prepare(
  `SELECT userId FROM users WHERE username = ?`,
);

const getUserIdByUsername = (username: string) => {
  const userId = getUserIdByUsernameQuery.get(username);
  return userId?.userId as string;
};

const addPseudonymQuery = db.prepare(
  `INSERT INTO pseudonyms (pseudoId, userId, expiresAt) VALUES (?, ?, ?)`,
);

const getLastInsertRowIdQuery = db.prepare(`SELECT last_insert_rowid() as id`);

const getTransactionsByUserIdQuery = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.pseudoId = ?`,
);

const getTransactionsByShopIdQuery = db.prepare(
  `SELECT * FROM transactions INNER JOIN transaction_items ON transactions.transactionId = transaction_items.transactionId INNER JOIN items ON transaction_items.itemId = items.itemId WHERE transactions.shopId = ?`,
);

const getTransactionByTransactionIdQuery = db.prepare(
  `SELECT * FROM transactions WHERE transactionId = ?`,
);

const getTransactionItemsByTransactionIdQuery = db.prepare(
  `SELECT * FROM transaction_items WHERE transactionId = ?`,
);

const getUserTransactionsByUserIdQuery = db.prepare(
  `SELECT * FROM user_transactions WHERE userId = ?`,
);

const getUserTransactionsByTransactionIdQuery = db.prepare(
  `SELECT * FROM user_transactions WHERE transactionId = ?`,
);

const getPseudonymByUserIdQuery = db.prepare(
  `SELECT * FROM pseudonyms WHERE userId = ?`,
);

const getUserIdByPseudoIdQuery = db.prepare(
  `SELECT userId FROM pseudonyms WHERE pseudoId = ?`,
);

const getUserPrivacyFieldByUserIdQuery = db.prepare(
  `SELECT visibility FROM privacy_settings WHERE userId = ? AND field = ?`,
);

const getUserWithRoleQuery = db.prepare(
  `SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE users.userId = ?`,
);

const addCustomerQuery = db.prepare(
  `INSERT INTO customers (customerId, isBiometric) VALUES (?, ?)`,
);

const addCustomer = (customer: Customer) => {
  addCustomerQuery.run(customer.customerId, customer.isBiometric ? 1 : 0);
};

const getCustomerByCustomerIdQuery = db.prepare(
  `SELECT * FROM customers WHERE customerId = ?`,
);

const getCustomerByCustomerId = (customerId: string) => {
  const customerData = getCustomerByCustomerIdQuery.get(customerId);
  const result = Customer.safeParse(customerData);
  if (!result.success) {
    console.error("Parse error in getCustomerByCustomerId:", result.error);
    return null;
  }
  return result.data;
};

// User queries
const getUserByUsername = (username: string) => {
  const userData = getUserByUsernameQuery.get(username);
  const result = User.safeParse(userData);
  if (!result.success) {
    console.error("Parse error in getUserByUsername:", result.error);
    return null;
  }
  return result.data;
};

const getUserById = (userId: string | null) => {
  if (!userId) {
    return null;
  }
  const userData = getUserByIdQuery.get(userId);
  const result = User.safeParse(userData);
  if (!result.success) {
    console.error("Parse error in getUserById:", result.error);
    return null;
  }
  return result.data;
};

const getUserByEmailHash = (emailHash: string) => {
  const userData = getUserByEmailHashQuery.get(emailHash);
  const result = User.safeParse(userData);
  if (!result.success) {
    console.error("Parse error in getUserByEmailHash:", result.error);
    return null;
  }
  return result.data;
};

const getUserPrivateDataByUserId = (userId: string) => {
  const row = getUserPrivateDataByUserIdQuery.get(userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return null;
  }

  const normalizeBlob = (value: unknown): unknown => {
    if (value instanceof Uint8Array) {
      return Buffer.from(value).toString("utf8");
    }
    return value;
  };

  const normalized = {
    ...row,
    original_cipher: normalizeBlob(row.original_cipher),
    original_iv: normalizeBlob(row.original_iv),
    original_aad: normalizeBlob(row.original_aad),
    anonymized_cipher: normalizeBlob(row.anonymized_cipher),
    anonymized_iv: normalizeBlob(row.anonymized_iv),
    anonymized_aad: normalizeBlob(row.anonymized_aad),
  };

  const result = UserPrivateData.safeParse(normalized);
  if (!result.success) {
    console.error("Parse error in getUserPrivateDataByUserId:", result.error);
    return null;
  }
  return result.data;
};

const addUserPrivateDataQuery = db.prepare(
  `INSERT INTO user_private_data (userId, original_cipher, original_iv, original_aad, anonymized_cipher, anonymized_iv, anonymized_aad)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(userId) DO UPDATE SET
     original_cipher = excluded.original_cipher,
     original_iv = excluded.original_iv,
     original_aad = excluded.original_aad,
     anonymized_cipher = excluded.anonymized_cipher,
     anonymized_iv = excluded.anonymized_iv,
     anonymized_aad = excluded.anonymized_aad,
     updatedAt = CURRENT_TIMESTAMP`,
);

const addUserPrivateData = (userId: string, privateData: UserPrivateData) => {
  addUserPrivateDataQuery.run(
    userId,
    privateData.original_cipher ?? null,
    privateData.original_iv ?? null,
    privateData.original_aad ?? null,
    privateData.anonymized_cipher ?? null,
    privateData.anonymized_iv ?? null,
    privateData.anonymized_aad ?? null,
  );
};

function updateUserPrivateDataQuery(
  userId: string,
  privateData: UserPrivateData,
) {
  const allFields = Object.keys(privateData).filter(
    (field) => field !== "userId",
  );
  const updateFields = allFields
    .map((field) => {
      return `${field} = ?`;
    })
    .join(", ");
  const values = allFields.map((field) => {
    const value = privateData[field as keyof UserPrivateData];
    return value ?? null;
  });
  values.push(userId);
  const stmt = db.prepare(
    `UPDATE user_private_data SET ${updateFields} WHERE userId = ?`,
  );
  const result = stmt.run(...values);
  return result;
}

const updateUserPrivateData = (
  userId: string,
  privateData: UserPrivateData,
) => {
  updateUserPrivateDataQuery(userId, privateData);
};

const deleteUser = (userId: string) => {
  deleteUserQuery.run(userId);
};

const updateUser = (userId: string, updates: Partial<User>) => {
  console.log("updates: ", updates);
  updateUserQuery(userId, updates);
};

const getAllUsersQuery = db.prepare(`SELECT * FROM users`);
const getAllUsers = () => {
  const usersData = getAllUsersQuery.all();
  return usersData
    .map((user) => {
      const result = User.safeParse(user);
      if (!result.success) {
        console.error("Parse error in getAllUsers:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((user) => user !== null);
};

const getUserForAuthenticationQuery = db.prepare(
  `SELECT * FROM users WHERE username = ?`,
);

const getUserForAuthentication = (username: string) => {
  const userData = getUserForAuthenticationQuery.get(username);
  const result = User.safeParse(userData);
  if (!result.success) {
    console.error("Parse error in getUserForAuthentication:", result.error);
    return null;
  }
  return result.data;
};

// Role queries
const addRole = (role: Omit<Role, "roleId">) => {
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
    role.hasGlobalAccessToAllShops ? 1 : 0,
  );
};

const getRoleById = (roleId: number) => {
  const roleData = getRoleByIdQuery.get(roleId);
  const result = Role.safeParse(roleData);
  if (!result.success) {
    console.error("Parse error in getRoleById:", result.error);
    return null;
  }
  return result.data;
};

const getRoleByUserId = (userId: string) => {
  const roleData = getRoleByUserIdQuery.get(userId);
  const result = Role.safeParse(roleData);
  if (!result.success) {
    console.error("Parse error in getRoleByUserId:", result.error);
    return null;
  }
  return result.data;
};

const getRoleByName = (roleName: string) => {
  const roleData = getRoleByNameQuery.get(roleName);
  const result = Role.safeParse(roleData);
  if (!result.success) {
    console.error("Parse error in getRoleByName:", result.error);
    return null;
  }
  return result.data;
};

const getRoles = () => {
  const rolesData = getRolesQuery.all();
  return rolesData
    .map((role) => {
      const result = Role.safeParse(role);
      if (!result.success) {
        console.error("Parse error in getRoles:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((role) => role !== null);
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
    roleId,
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
    shopWithoutId.shopOwnerId,
  );
};

const getShopById = (shopId: number) => {
  const shopData = getShopByIdQuery.get(shopId);
  const result = Shop.safeParse(shopData);
  if (!result.success) {
    console.error("Parse error in getShopById:", result.error);
    return null;
  }
  return result.data;
};

const getAllShops = () => {
  const shopsData = getAllShopsQuery.all();
  return shopsData
    .map((shop) => {
      const result = Shop.safeParse(shop);
      if (!result.success) {
        console.error("Parse error in getAllShops:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((shop) => shop !== null);
};

const getShopByOwnerId = (ownerId: string) => {
  const shopData = getShopByOwnerIdQuery.get(ownerId);
  const result = Shop.safeParse(shopData);
  if (!result.success) {
    console.error("Parse error in getShopByOwnerId:", result.error);
    return null;
  }
  return result.data;
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
  return shopsData
    .map((shop) => {
      const result = Shop.safeParse(shop);
      if (!result.success) {
        console.error("Parse error in getUserShops:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((shop) => shop !== null);
};

const getShopUsers = (shopId: number) => {
  const usersData = getShopUsersQuery.all(shopId, shopId);
  console.log("usersData: ", usersData);
  return usersData;
};

// Statistics queries
const addStatisticQuery = db.prepare(
  `INSERT INTO shop_visits (userId, customerId, shopId, visitAt) VALUES (?, ?, ?, ?)`,
);

const addStatistic = (statistic: Statistic) => {
  const statisticWithoutId = mapUndefinedToNull(statistic);
  addStatisticQuery.run(
    statisticWithoutId.userId,
    statisticWithoutId.customerId,
    statisticWithoutId.shopId,
    statisticWithoutId.visitAt,
  );
};

// Token queries
const addToken = (token: Token) => {
  const tokenWithoutId = mapUndefinedToNull(token);
  return addTokenQuery.run(
    tokenWithoutId.token,
    tokenWithoutId.expiresAt,
    tokenWithoutId.purpose,
    tokenWithoutId.userId,
  );
};

const deleteToken = (token: string, purpose: string) => {
  deleteTokenQuery.run(token, purpose);
};

// Privacy Settings queries
const addUserPrivacy = (
  privacySetting: Omit<PrivacySettingRecord, "privacyId">,
) => {
  const settingWithoutId = mapUndefinedToNull(privacySetting);
  addUserPrivacyQuery.run(
    settingWithoutId.userId,
    settingWithoutId.field,
    settingWithoutId.visibility,
  );
};

const getUserPrivacyByUserId = (userId: string) => {
  const privacyData = getUserPrivacyByUserIdQuery.all(userId);
  return privacyData
    .map((privacy) => {
      const result = PrivacySettings.safeParse(privacy);
      if (!result.success) {
        console.error("Parse error in getUserPrivacyByUserId:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((privacy) => privacy !== null);
};

const getUserPrivacyByUserIdAndField = (userId: string, field: string) => {
  const privacyData = getUserPrivacyByUserIdAndFieldQuery.get(userId, field);
  const result = PrivacySettings.safeParse(privacyData);
  if (!result.success) {
    console.error(
      "Parse error in getUserPrivacyByUserIdAndField:",
      result.error,
    );
    return null;
  }
  return result.data;
};

const updateUserPrivacy = (
  privacySetting: Omit<PrivacySettingRecord, "privacyId">,
) => {
  const settingWithoutId = mapUndefinedToNull(privacySetting);
  console.log("settingWithoutId: ", settingWithoutId);
  return updateUserPrivacyQuery.run(
    settingWithoutId.visibility,
    settingWithoutId.userId,
    settingWithoutId.field,
  );
};

const insertUserPrivacy = (
  privacySetting: Omit<PrivacySettingRecord, "privacyId">,
) => {
  const settingWithoutId = mapUndefinedToNull(privacySetting);
  return insertUserPrivacyQuery.run(
    settingWithoutId.userId,
    settingWithoutId.field,
    settingWithoutId.visibility,
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
    itemWithoutId.shopId,
  );
};

const getItemByNameAndShop = (itemName: string, shopId: number) => {
  const itemData = getItemByNameAndShopQuery.get(itemName, shopId);
  const result = Item.safeParse(itemData);
  if (!result.success) {
    console.error("Parse error in getItemByNameAndShop:", result.error);
    return null;
  }
  return result.data;
};

// Transaction queries
const addTransaction = (
  transaction: Omit<
    Transaction,
    "transactionId" | "itemId" | "itemName" | "itemPrice" | "quantity"
  >,
) => {
  const transactionWithoutId = mapUndefinedToNull(transaction);
  addTransactionQuery.run(
    transactionWithoutId.shopId,
    transactionWithoutId.pseudoId,
    transactionWithoutId.totalPrice,
    transactionWithoutId.location,
    transactionWithoutId.paymentMethod,
    transactionWithoutId.purchaseType,
  );
};

const getTransactionByTransactionId = (transactionId: number) => {
  const transactionData = getTransactionByTransactionIdQuery.get(transactionId);
  const result = Transaction.safeParse(transactionData);
  if (!result.success) {
    console.error(
      "Parse error in getTransactionByTransactionId:",
      result.error,
    );
    return null;
  }
  return result.data;
};

const getTransactionsByUserId = (pseudoId: string) => {
  const transactionsData = getTransactionsByUserIdQuery.all(pseudoId);
  return transactionsData
    .map((transaction) => {
      const result = Transaction.safeParse(transaction);
      if (!result.success) {
        console.error("Parse error in getTransactionsByUserId:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((transaction) => transaction !== null);
};

const getTransactionsByShopId = (shopId: number) => {
  const transactionsData = getTransactionsByShopIdQuery.all(shopId);
  return transactionsData
    .map((transaction) => {
      const result = Transaction.safeParse(transaction);
      if (!result.success) {
        console.error("Parse error in getTransactionsByShopId:", result.error);
        return null;
      }
      return result.data;
    })
    .filter((transaction) => transaction !== null);
};

// Transaction Item queries
const addTransactionItem = (transactionItem: TransactionItem) => {
  const itemWithoutAutoId = mapUndefinedToNull(transactionItem);
  addTransactionItemQuery.run(
    itemWithoutAutoId.transactionId,
    itemWithoutAutoId.itemId,
    itemWithoutAutoId.quantity,
  );
};

const getTransactionItemsByTransactionId = (transactionId: number) => {
  const itemsData = getTransactionItemsByTransactionIdQuery.all(transactionId);
  return itemsData
    .map((item) => {
      const result = TransactionItem.safeParse(item);
      if (!result.success) {
        console.error(
          "Parse error in getTransactionItemsByTransactionId:",
          result.error,
        );
        return null;
      }
      return result.data;
    })
    .filter((item) => item !== null);
};

// User Transaction queries
const linkUserTransaction = (userId: string, transactionId: number) => {
  linkUserTransactionQuery.run(userId, transactionId);
};

const getUserTransactionsByUserId = (userId: string) => {
  const userTransactionsData = getUserTransactionsByUserIdQuery.all(userId);
  return userTransactionsData
    .map((ut) => {
      const result = UserTransaction.safeParse(ut);
      if (!result.success) {
        console.error(
          "Parse error in getUserTransactionsByUserId:",
          result.error,
        );
        return null;
      }
      return result.data;
    })
    .filter((ut) => ut !== null);
};

const getUserTransactionsByTransactionId = (transactionId: number) => {
  const userTransactionsData =
    getUserTransactionsByTransactionIdQuery.all(transactionId);
  return userTransactionsData
    .map((ut) => {
      const result = UserTransaction.safeParse(ut);
      if (!result.success) {
        console.error(
          "Parse error in getUserTransactionsByTransactionId:",
          result.error,
        );
        return null;
      }
      return result.data;
    })
    .filter((ut) => ut !== null);
};

// Pseudonym queries
const addPseudonym = (pseudonym: Pseudonym) => {
  const pseudonymData = mapUndefinedToNull(pseudonym);
  addPseudonymQuery.run(
    pseudonymData.pseudoId,
    pseudonymData.userId,
    pseudonymData.expiresAt,
  );
};

const getPseudonymByUserId = (userId: string) => {
  const pseudonymData = getPseudonymByUserIdQuery.get(userId);
  const result = Pseudonym.safeParse(pseudonymData);
  if (!result.success) {
    console.error("Parse error in getPseudonymByUserId:", result.error);
    return null;
  }
  return result.data;
};

const getUserIdByPseudoId = (pseudoId: string) => {
  const data = getUserIdByPseudoIdQuery.get(pseudoId);
  return data?.userId as string | undefined;
};

// Utility queries
const getLastInsertRowId = () => {
  const result = getLastInsertRowIdQuery.get();
  return result ? (result.id as number) : null;
};

export {
  db,
  addUser,
  getAllUsers,
  getUserByUsername,
  getUserById,
  getUserByEmailHash,
  getUserPrivateDataByUserId,
  getRoleByUserId,
  updateUser,
  addCustomerToShop,
  addUserEmbedding,
  getUserEmbeddingsByUserId,
  getUserIdByUsername,
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
  addUserPrivateData,
  addUserToShop,
  getUserShops,
  getShopUsers,
  addShopOwnerToShop,
  addToken,
  getToken,
  deleteToken,
  addUserPrivacy,
  getUserPrivacyByUserId,
  addCustomer,
  getCustomerByCustomerId,
  getUserWithRoleQuery,
  getAllShops,
  getUserForAuthentication,
  addCustomerEmbedding,
  updateUserPrivacy,
  insertUserPrivacy,
  getUserPrivacyByUserIdAndField,
  updateUserPrivateData,
  addItem,
  getItemByNameAndShop,
  addTransaction,
  addTransactionItem,
  linkUserTransaction,
  addPseudonym,
  getAllEmbeddings,
  addStatistic,
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
  getUserPrivacyPresetById,
};
