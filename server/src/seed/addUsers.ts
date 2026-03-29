import {
  addPseudonym,
  addUser,
  addUserPrivateData,
  addProvider,
} from "../database.ts";
import { buildEncryptedSeedUser } from "../lib/encryption.ts";
import { applyPrivacyPreset } from "../services/privacy.ts";

type SeedUser = {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  country: string;
  city: string;
  address: string;
  zip: string;
  spendings: string;
  shoppingHistory: string;
  shops: string[];
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
    phoneNumber: "+421900000001",
    dateOfBirth: "1990-01-01",
    gender: "other",
    country: "Slovakia",
    city: "Bratislava",
    address: "Admin street 1",
    zip: "81101",
    spendings: "0",
    shoppingHistory: "[]",
    shops: ["Shop 1", "Shop 2", "Shop 3"],
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
    phoneNumber: "+420900000002",
    dateOfBirth: "1995-05-12",
    gender: "female",
    country: "Czechia",
    city: "Prague",
    address: "Main square 2",
    zip: "04001",
    spendings: "1450",
    shoppingHistory: '[{"shop":"Shop 1","total":1450}]',
    shops: ["Shop 1"],
    password: "user",
    roleId: 2,
    pseudoId: "puser",
    privacyPreset: "pl4",
  },
  {
    userId: "p1",
    username: "shop owner 1",
    email: "shop owner1@example.com",
    firstName: "shop owner 1",
    lastName: "shop owner 1",
    phoneNumber: "+420900000101",
    dateOfBirth: "1988-03-02",
    gender: "male",
    country: "Czechia",
    city: "Prague",
    address: "Shop owner avenue 10",
    zip: "94901",
    spendings: "0",
    shoppingHistory: "[]",
    shops: ["Shop 1"],
    password: "shop owner 1",
    roleId: 3,
    pseudoId: "pshop1",
  },
  {
    userId: "p2",
    username: "shop owner 2",
    email: "shop owner2@example.com",
    firstName: "shop owner 2",
    lastName: "shop owner 2",
    phoneNumber: "+420900000102",
    dateOfBirth: "1987-07-11",
    gender: "female",
    country: "Czechia",
    city: "Brno",
    address: "Shop owner avenue 20",
    zip: "91701",
    spendings: "0",
    shoppingHistory: "[]",
    shops: ["Shop 2"],
    password: "shop owner 2",
    roleId: 3,
    pseudoId: "pshop2",
  },
  {
    userId: "p3",
    username: "shop owner 3",
    email: "shop owner3@example.com",
    firstName: "shop owner 3",
    lastName: "shop owner 3",
    phoneNumber: "+420900000103",
    dateOfBirth: "1985-10-19",
    gender: "male",
    country: "Czechia",
    city: "Ostrava",
    address: "Shop owner avenue 30",
    zip: "01001",
    spendings: "0",
    shoppingHistory: "[]",
    shops: ["Shop 3"],
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
      privacyPreset: seedUser.privacyPreset ?? "pl4",
      privateProfile: {
        username: seedUser.username,
        email: seedUser.email,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        phoneNumber: seedUser.phoneNumber,
        dateOfBirth: seedUser.dateOfBirth,
        gender: seedUser.gender,
        country: seedUser.country,
        city: seedUser.city,
        address: seedUser.address,
        zip: seedUser.zip,
        spendings: seedUser.spendings,
        shoppingHistory: seedUser.shoppingHistory,
        shops: seedUser.shops,
      },
    });

    addUser(encryptedSeedUser.user);
    addUserPrivateData(seedUser.userId, encryptedSeedUser.privateData);
    applyPrivacyPreset(seedUser.userId, seedUser.privacyPreset ?? "pl4");
    addPseudonym({
      pseudoId: seedUser.pseudoId,
      userId: seedUser.userId,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });
  }
};

const addProviders = async () => {
  const providerSeedUsers = seedUsers.filter(
    (seedUser) => seedUser.roleId === 3,
  );

  for (const provider of providerSeedUsers) {
    addProvider(provider.userId, `${provider.firstName} ${provider.lastName}`);
  }
};

addUsers()
  .then(async () => {
    await addProviders();
  })
  .catch((error) => {
    console.error("Failed to seed", error);
    process.exit(1);
  });
