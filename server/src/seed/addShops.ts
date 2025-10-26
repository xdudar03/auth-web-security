import { addShop, addUserToShop } from "../database.ts";

const addHardcodedShops = () => {
  addShop.run("Shop 1", "Shop 1 description", "Shop 1 address", "3");
  addShop.run("Shop 2", "Shop 2 description", "Shop 2 address", "4");
  addShop.run("Shop 3", "Shop 3 description", "Shop 3 address", "5");
  addUserToShop.run("1", 1);
  addUserToShop.run("1", 2);
  addUserToShop.run("1", 3);
  addUserToShop.run("2", 1);
  addUserToShop.run("3", 1);
  addUserToShop.run("4", 2);
  addUserToShop.run("5", 3);
};

addHardcodedShops();
