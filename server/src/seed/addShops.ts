import { addShop, addUserToShop } from "../database.ts";

const addHardcodedShops = () => {
  addShop({
    shopName: "Shop 1",
    shopDescription: "Shop 1 description",
    shopAddress: "Shop 1 address",
    shopOwnerId: "3",
  });
  addShop({
    shopName: "Shop 2",
    shopDescription: "Shop 2 description",
    shopAddress: "Shop 2 address",
    shopOwnerId: "4",
  });
  addShop({
    shopName: "Shop 3",
    shopDescription: "Shop 3 description",
    shopAddress: "Shop 3 address",
    shopOwnerId: "5",
  });

  addUserToShop("1", 1); // [userId, shopId]
  addUserToShop("1", 2);
  addUserToShop("1", 3);
  addUserToShop("2", 1);
  addUserToShop("3", 1);
  addUserToShop("4", 2);
  addUserToShop("5", 3);
};

addHardcodedShops();
