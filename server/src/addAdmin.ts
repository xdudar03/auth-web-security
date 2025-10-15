import { addUser } from "./database.ts";

const addAdmin = () => {
  addUser.run(
    "1", // userId
    "admin", // username
    "admin@example.com", // email
    "admin", // firstName
    "admin", // lastName
    "admin", // password
    1 // roleId
  );
  addUser.run(
    "2",
    "user",
    "user@example.com",
    "user", // firstName
    "user", // lastName
    "user", // password
    2 // roleId
  );
  addUser.run(
    "3",
    "shop owner",
    "shop owner@example.com",
    "shop owner", // firstName
    "shop owner", // lastName
    "shop owner", // password
    3 // roleId
  );
};

addAdmin();
