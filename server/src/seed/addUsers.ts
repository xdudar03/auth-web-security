import { addUser } from "../database.ts";
import bcrypt from "bcryptjs";

const addUsers = () => {
  const salt = bcrypt.genSaltSync(10);

  addUser.run(
    "1", // userId
    "admin", // username
    "admin@example.com", // email
    "admin", // firstName
    "admin", // lastName
    bcrypt.hashSync("admin", salt), // password
    1 // roleId
  );
  addUser.run(
    "2",
    "user",
    "user@example.com",
    "user", // firstName
    "user", // lastName
    bcrypt.hashSync("user", salt), // password
    2 // roleId
  );
  addUser.run(
    "3",
    "shop owner 1",
    "shop owner1@example.com",
    "shop owner 1", // firstName
    "shop owner 1", // lastName
    bcrypt.hashSync("shop owner 1", salt), // password
    3 // roleId
  );
  addUser.run(
    "4",
    "shop owner 2",
    "shop owner2@example.com",
    "shop owner 2", // firstName
    "shop owner 2", // lastName
    bcrypt.hashSync("shop owner 2", salt), // password
    3 // roleId
  );
  addUser.run(
    "5",
    "shop owner 3",
    "shop owner3@example.com",
    "shop owner 3", // firstName
    "shop owner 3", // lastName
    bcrypt.hashSync("shop owner 3", salt), // password
    3 // roleId
  );
};

addUsers();
