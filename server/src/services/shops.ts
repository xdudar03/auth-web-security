import {
  db,
  getShopById,
  getShopUsers,
  getUserPrivacyByUserId,
  getAllShops as getAllShopsDatabase,
} from "../database.ts";
import { sanitizeUserSummary } from "./admin.ts";

export function getAllShops() {
  const shops = getAllShopsDatabase();
  console.log("shops: ", shops);
  return {
    shops: shops,
  };
}

export function getAllUsersFromShop(shopId: number) {
  console.log("shopId: ", shopId);
  const users = getShopUsers(shopId);

  users.forEach((user: any) => {
    const shop = getShopById(shopId);
    const privacy = getUserPrivacyByUserId(user.userId);
    console.log("privacy: ", privacy);
    user.shop = shop;
    user.privacy = privacy;
  });
  console.log("users: ", users);
  const response = users.map((row: any) => sanitizeUserSummary(row));
  console.log("response: ", response);
  return { users: response };
}
