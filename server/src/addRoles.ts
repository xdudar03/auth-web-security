import { addRole } from "./database.ts";

const addHardcodedRoles = () => {
  addRole.run("admin", 1, 1, 1, 1, 1, 1, 1, 1);
  addRole.run("user", 0, 0, 0, 0, 0, 0, 0, 1);
  addRole.run("shop owner", 0, 0, 1, 0, 0, 0, 0, 0);
};

addHardcodedRoles();
