import {
  addPseudonym,
  addUser,
  addUserPrivacy,
  addUserPrivateData,
  addUserToShop,
} from "../database.ts";
import { buildEncryptedSeedUser } from "./encryption.ts";
import type { Visibility } from "../types/privacySetting.ts";

const FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "dateOfBirth",
  "gender",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "spendings",
  "shoppingHistory",
  "shops",
] as const;

type Field = (typeof FIELDS)[number];

type UserRecord = {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: number;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  spendings: string;
  shops: number[];
  pseudoId?: string;
  privacyMap: Partial<Record<Field, Visibility>>;
};

const visibilityForAllFields = (
  visibility: Visibility,
): Partial<Record<Field, Visibility>> =>
  Object.fromEntries(FIELDS.map((field) => [field, visibility])) as Partial<
    Record<Field, Visibility>
  >;

const usersWithPrivacy: UserRecord[] = [
  {
    userId: "u101",
    username: "hidden_all",
    email: "hidden_all@example.com",
    firstName: "Hidden",
    lastName: "All",
    password: "password1",
    roleId: 2,
    phoneNumber: "+1-202-555-0101",
    dateOfBirth: "1990-01-01",
    gender: "non-binary",
    address: "123 Hidden St",
    city: "Nowhere",
    state: "NA",
    zip: "00000",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 0 }),
    shops: [3],
    pseudoId: "p101",
    privacyMap: visibilityForAllFields("hidden"),
  },
  {
    userId: "u102",
    username: "anon_all",
    email: "anon_all@example.com",
    firstName: "Anon",
    lastName: "All",
    password: "password2",
    roleId: 2,
    phoneNumber: "+1-202-555-0102",
    dateOfBirth: "1988-02-02",
    gender: "female",
    address: "456 Anon Ave",
    city: "Mystery",
    state: "ZZ",
    zip: "11111",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 1500 }),
    shops: [1],
    pseudoId: "p102",
    privacyMap: visibilityForAllFields("anonymized"),
  },
  {
    userId: "u103",
    username: "visible_all",
    email: "visible_all@example.com",
    firstName: "Visible",
    lastName: "All",
    password: "password3",
    roleId: 2,
    phoneNumber: "+1-202-555-0103",
    dateOfBirth: "1995-03-03",
    gender: "male",
    address: "789 Open Rd",
    city: "Sunlight",
    state: "CA",
    zip: "90210",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 3200 }),
    shops: [2, 3],
    privacyMap: visibilityForAllFields("visible"),
  },
  {
    userId: "u104",
    username: "mixed_a",
    email: "mixed_a@example.com",
    firstName: "Mixed",
    lastName: "Alpha",
    password: "password4",
    roleId: 2,
    phoneNumber: "+1-202-555-0104",
    dateOfBirth: "1992-04-04",
    gender: "female",
    address: "10 Blend Blvd",
    city: "Fusion",
    state: "NY",
    zip: "10001",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 640 }),
    shops: [1, 2],
    privacyMap: {
      firstName: "visible",
      lastName: "visible",
      email: "visible",
      phoneNumber: "visible",
      dateOfBirth: "anonymized",
      gender: "anonymized",
      address: "anonymized",
      city: "anonymized",
      state: "anonymized",
      zip: "anonymized",
      country: "anonymized",
      spendings: "hidden",
      shoppingHistory: "hidden",
      shops: "hidden",
    },
  },
  {
    userId: "u105",
    username: "mixed_b",
    email: "mixed_b@example.com",
    firstName: "Mixed",
    lastName: "Beta",
    password: "password5",
    roleId: 2,
    phoneNumber: "+1-202-555-0105",
    dateOfBirth: "1998-05-05",
    gender: "non-binary",
    address: "22 Mosaic St",
    city: "Patchwork",
    state: "TX",
    zip: "73301",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 9800 }),
    shops: [1, 2, 3],
    privacyMap: {
      firstName: "hidden",
      lastName: "hidden",
      email: "hidden",
      phoneNumber: "hidden",
      dateOfBirth: "hidden",
      gender: "hidden",
      address: "visible",
      city: "visible",
      state: "visible",
      zip: "visible",
      country: "visible",
      spendings: "anonymized",
      shoppingHistory: "anonymized",
      shops: "anonymized",
    },
  },
];

function setPrivacy(userId: string, map: Partial<Record<Field, Visibility>>) {
  for (const field of FIELDS) {
    const visibility = map[field] ?? "visible";
    addUserPrivacy({ userId, field, visibility });
  }
}

async function seedUsersWithPrivacy() {
  for (const userRecord of usersWithPrivacy) {
    const encryptedSeedUser = await buildEncryptedSeedUser({
      userId: userRecord.userId,
      username: userRecord.username,
      email: userRecord.email,
      password: userRecord.password,
      recoveryPassphrase: userRecord.password,
      roleId: userRecord.roleId,
      privateProfile: {
        username: userRecord.username,
        email: userRecord.email,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        phoneNumber: userRecord.phoneNumber,
        dateOfBirth: userRecord.dateOfBirth,
        gender: userRecord.gender,
        address: userRecord.address,
        city: userRecord.city,
        state: userRecord.state,
        zip: userRecord.zip,
        country: userRecord.country,
        spendings: userRecord.spendings,
        shops: userRecord.shops,
      },
    });

    addUser(encryptedSeedUser.user);
    addUserPrivateData(userRecord.userId, encryptedSeedUser.privateData);
    setPrivacy(userRecord.userId, userRecord.privacyMap);

    for (const shopId of userRecord.shops) {
      addUserToShop(userRecord.userId, shopId);
    }

    if (userRecord.pseudoId) {
      addPseudonym({
        pseudoId: userRecord.pseudoId,
        userId: userRecord.userId,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      });
    }
  }
}

seedUsersWithPrivacy().catch((error) => {
  console.error("Failed to seed privacy test users", error);
  process.exit(1);
});
