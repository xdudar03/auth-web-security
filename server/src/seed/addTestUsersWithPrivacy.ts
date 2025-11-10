import {
  addPseudonym,
  addUser,
  addUserPrivacy,
  addUserToShop,
} from "../database.ts";
import bcrypt from "bcryptjs";

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

type Visibility = "hidden" | "anonymized" | "visible";

function insertUser(u: UserRecord) {
  addUser.run(
    u.userId,
    u.username,
    u.email,
    u.firstName,
    u.lastName,
    u.password,
    u.roleId,
    u.phoneNumber,
    u.dateOfBirth,
    u.gender,
    u.address,
    u.city,
    u.state,
    u.zip,
    u.country,
    u.spendings,
    null, // embedding excluded
    null // credentials excluded
  );
}

function setPrivacy(
  userId: string,
  map: Record<(typeof FIELDS)[number], Visibility>
) {
  for (const field of FIELDS) {
    const visibility = map[field] ?? "visible";
    addUserPrivacy.run(userId, field, visibility);
  }
}

function seedUsersWithPrivacy() {
  const salt = bcrypt.genSaltSync(10);
  // 1) All hidden
  insertUser({
    userId: "u101",
    username: "hidden_all",
    email: "hidden_all@example.com",
    firstName: "Hidden",
    lastName: "All",
    password: bcrypt.hashSync("password1", salt),
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
  });
  setPrivacy(
    "u101",
    Object.fromEntries(FIELDS.map((f) => [f, "hidden"])) as any
  );
  addUserToShop.run("u101", 3);
  addPseudonym.run("p101", "u101", null);

  // 2) All anonymized
  insertUser({
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
  });
  setPrivacy(
    "u102",
    Object.fromEntries(FIELDS.map((f) => [f, "anonymized"])) as any
  );
  addUserToShop.run("u102", 1);
  addPseudonym.run("p102", "u102", null);

  // 3) All visible
  insertUser({
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
  });
  setPrivacy(
    "u103",
    Object.fromEntries(FIELDS.map((f) => [f, "visible"])) as any
  );
  addUserToShop.run("u103", 2);
  addUserToShop.run("u103", 3);

  // 4) Mixed A: contact visible, demographics anonymized, finances hidden
  insertUser({
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
  addUserToShop.run("u104", 1);
  addUserToShop.run("u104", 2);

  // 5) Mixed B: profile hidden, location visible, purchase anonymized
  insertUser({
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
  addUserToShop.run("u105", 1);
  addUserToShop.run("u105", 2);
  addUserToShop.run("u105", 3);
}

seedUsersWithPrivacy();
