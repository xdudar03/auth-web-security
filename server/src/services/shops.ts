import {
  db,
  getShopById,
  getShopUsers,
  getUserPrivacyByUserId,
} from "../database.ts";
import { sanitizeUserSummary } from "./admin.ts";

export function getAllShops() {
  const shops = db.prepare("SELECT * FROM shops").all();
  console.log("shops: ", shops);
  return {
    shops: shops,
  };
}

export function getAllUsersFromShop(shopId: number) {
  console.log("shopId: ", shopId);
  const users = getShopUsers.all(shopId);

  users.forEach((user: any) => {
    const shop = getShopById.get(shopId);
    const privacy = getUserPrivacyByUserId.get(user.userId);
    console.log("privacy: ", privacy);
    user.shop = shop;
    user.privacy = privacy;
  });
  console.log("users: ", users);
  const response = users.map((row: any) => sanitizeUserSummary(row));
  console.log("response: ", response);
  return { users: response };
}
