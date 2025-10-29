import type { JwtPayload } from "jsonwebtoken";
import {
  db,
  getRoleByUserId,
  getUserById,
  getUserPrivacyByUserId,
  getUserShops,
} from "../database.ts";
import { HttpError } from "../errors.ts";

export default function getUserInfo(user: JwtPayload | null) {
  if (!user) {
    throw new HttpError(401, "User not found");
  }
  // get user info, roles and user shops from database
  const userInfo = getUserById.get(user.userId);
  const role = getRoleByUserId.get(user.userId);
  const userShops = getUserShops.all(user.userId);
  const userPrivacy = getUserPrivacyByUserId.all(user.userId);
  console.log("userPrivacy: ", userPrivacy);
  console.log("userInfo: ", userInfo);
  console.log("role: ", role);
  console.log("userShops: ", userShops);
  return { user: userInfo, role: role, shops: userShops, privacy: userPrivacy };
}
