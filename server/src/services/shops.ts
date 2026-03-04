import {
  getShopById,
  getShopUsers,
  getUserPrivacyByUserId,
  getAllShops as getAllShopsDatabase,
  getShopVisitsByShopId,
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
  const users = getShopUsers(shopId);

  users.forEach((user: any) => {
    const shop = getShopById(shopId);
    const privacy = getUserPrivacyByUserId(user.userId);
    user.shop = shop;
    user.privacy = privacy;
  });
  const response = users.map((row: any) => sanitizeUserSummary(row));
  return { users: response };
}

export function getShopVisits(shopId: number) {
  const visits = getShopVisitsByShopId(shopId);
  return { visits };
}
