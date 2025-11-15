import { addPseudonym, addUser } from "../database.ts";
import bcrypt from "bcryptjs";

const addUsers = () => {
  const salt = bcrypt.genSaltSync(10);

  addUser({
    userId: "1", // userId
    username: "admin", // username
    email: "admin@example.com", // email
    firstName: "admin", // firstName
    lastName: "admin", // lastName
    password: bcrypt.hashSync("admin", salt), // password
    roleId: 1, // roleId
  });
  addPseudonym({
    pseudoId: "padmin",
    userId: "1",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  addUser({
    userId: "2",
    username: "user",
    email: "user@example.com",
    firstName: "user", // firstName
    lastName: "user", // lastName
    password: bcrypt.hashSync("user", salt), // password
    roleId: 2, // roleId
  });
  addPseudonym({
    pseudoId: "puser",
    userId: "2",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  addUser({
    userId: "3",
    username: "shop owner 1",
    email: "shop owner1@example.com",
    firstName: "shop owner 1", // firstName
    lastName: "shop owner 1", // lastName
    password: bcrypt.hashSync("shop owner 1", salt), // password
    roleId: 3, // roleId
  });
  addPseudonym({
    pseudoId: "pshop1",
    userId: "3",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  addUser({
    userId: "4",
    username: "shop owner 2",
    email: "shop owner2@example.com",
    firstName: "shop owner 2", // firstName
    lastName: "shop owner 2", // lastName
    password: bcrypt.hashSync("shop owner 2", salt), // password
    roleId: 3, // roleId
  });
  addPseudonym({
    pseudoId: "pshop2",
    userId: "4",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  addUser({
    userId: "5",
    username: "shop owner 3",
    email: "shop owner3@example.com",
    firstName: "shop owner 3", // firstName
    lastName: "shop owner 3", // lastName
    password: bcrypt.hashSync("shop owner 3", salt), // password
    roleId: 3, // roleId
  });
  addPseudonym({
    pseudoId: "pshop3",
    userId: "5",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
};

addUsers();
