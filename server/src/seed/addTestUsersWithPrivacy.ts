import {
  addPseudonym,
  addUser,
  addUserPrivacy,
  addUserToShop,
} from "../database.ts";
import bcrypt from "bcryptjs";
import type { Visibility } from "../types/privacySetting.ts";

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
  // embedding: excluded per request
  // credentials: excluded per request
};

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

function setPrivacy(
  userId: string,
  map: Record<(typeof FIELDS)[number], Visibility>,
) {
  for (const field of FIELDS) {
    const visibility = map[field] ?? "visible";
    addUserPrivacy({ userId, field, visibility });
  }
}

function seedUsersWithPrivacy() {
  const salt = bcrypt.genSaltSync(10);
  // 1) All hidden
  addUser({
    userId: "u101",
    username: "hidden_all",
    email: "hidden_all@example.com",
    firstName: "Hidden",
    lastName: "All",
    password: bcrypt.hashSync("password1", salt),
    roleId: 2,
    isBiometric: false,
    phoneNumber: "+1-202-555-0101",
    dateOfBirth: "1990-01-01",
    gender: "non-binary",
    address: "123 Hidden St",
    city: "Nowhere",
    state: "NA",
    zip: "00000",
    country: "US",
    spendings: JSON.stringify({ currency: "USD", total: 0 }),
  });
  setPrivacy(
    "u101",
    Object.fromEntries(FIELDS.map((f) => [f, "hidden"])) as any,
  );
  addUserToShop("u101", 3);
  addPseudonym({
    pseudoId: "p101",
    userId: "u101",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });

  // 2) All anonymized
  addUser({
    userId: "u102",
    username: "anon_all",
    email: "anon_all@example.com",
    firstName: "Anon",
    lastName: "All",
    password: bcrypt.hashSync("password2", salt),
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
    isBiometric: false,
  });
  setPrivacy(
    "u102",
    Object.fromEntries(FIELDS.map((f) => [f, "anonymized"])) as any,
  );
  addUserToShop("u102", 1);
  addPseudonym({
    pseudoId: "p102",
    userId: "u102",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });

  // 3) All visible
  addUser({
    userId: "u103",
    username: "visible_all",
    email: "visible_all@example.com",
    firstName: "Visible",
    lastName: "All",
    password: bcrypt.hashSync("password3", salt),
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
    isBiometric: false,
  });
  setPrivacy(
    "u103",
    Object.fromEntries(FIELDS.map((f) => [f, "visible"])) as any,
  );
  addUserToShop("u103", 2);
  addUserToShop("u103", 3);

  // 4) Mixed A: contact visible, demographics anonymized, finances hidden
  addUser({
    userId: "u104",
    username: "mixed_a",
    email: "mixed_a@example.com",
    firstName: "Mixed",
    lastName: "Alpha",
    password: bcrypt.hashSync("password4", salt),
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
    isBiometric: false,
  });
  setPrivacy("u104", {
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
  });
  addUserToShop("u104", 1);
  addUserToShop("u104", 2);

  // 5) Mixed B: profile hidden, location visible, purchase anonymized
  addUser({
    userId: "u105",
    username: "mixed_b",
    email: "mixed_b@example.com",
    firstName: "Mixed",
    lastName: "Beta",
    password: bcrypt.hashSync("password5", salt),
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
    isBiometric: false,
  });
  setPrivacy("u105", {
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
  });
  addUserToShop("u105", 1);
  addUserToShop("u105", 2);
  addUserToShop("u105", 3);
}

seedUsersWithPrivacy();
