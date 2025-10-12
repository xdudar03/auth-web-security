import { addUser } from "./database.ts";

const addAdmin = () => {
  addUser.run("admin", "admin", "admin", "", 1);
  addUser.run("shop owner", "shop owner", "shop owner", "", 3);
};

addAdmin();
