import { addPseudonym, addUser, addUserPrivateData } from "../database.ts";
import { buildEncryptedSeedUser } from "./encryption.ts";

type SeedUser = {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: number;
  pseudoId: string;
  privacyPreset?: string;
};

const seedUsers: SeedUser[] = [
  {
    userId: "1",
    username: "admin",
    email: "admin@example.com",
    firstName: "admin",
    lastName: "admin",
    password: "admin",
    roleId: 1,
    pseudoId: "padmin",
  },
  {
    userId: "2",
    username: "user",
    email: "user@example.com",
    firstName: "user",
    lastName: "user",
    password: "user",
    roleId: 2,
    pseudoId: "puser",
    privacyPreset: "pl4",
  },
  {
    userId: "3",
    username: "shop owner 1",
    email: "shop owner1@example.com",
    firstName: "shop owner 1",
    lastName: "shop owner 1",
    password: "shop owner 1",
    roleId: 3,
    pseudoId: "pshop1",
  },
  {
    userId: "4",
    username: "shop owner 2",
    email: "shop owner2@example.com",
    firstName: "shop owner 2",
    lastName: "shop owner 2",
    password: "shop owner 2",
    roleId: 3,
    pseudoId: "pshop2",
  },
  {
    userId: "5",
    username: "shop owner 3",
    email: "shop owner3@example.com",
    firstName: "shop owner 3",
    lastName: "shop owner 3",
    password: "shop owner 3",
    roleId: 3,
    pseudoId: "pshop3",
  },
];

const addUsers = async () => {
  for (const seedUser of seedUsers) {
    const encryptedSeedUser = await buildEncryptedSeedUser({
      userId: seedUser.userId,
      username: seedUser.username,
      email: seedUser.email,
      password: seedUser.password,
      recoveryPassphrase: seedUser.password,
      roleId: seedUser.roleId,
      privacyPreset: "pl4",
      privateProfile: {
        username: seedUser.username,
        email: seedUser.email,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
      },
    });

    addUser(encryptedSeedUser.user);
    addUserPrivateData(seedUser.userId, encryptedSeedUser.privateData);
    addPseudonym({
      pseudoId: seedUser.pseudoId,
      userId: seedUser.userId,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });
  }
};

addUsers().catch((error) => {
  console.error("Failed to seed default users", error);
  process.exit(1);
});
