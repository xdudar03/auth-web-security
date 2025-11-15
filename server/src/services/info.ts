import type { JwtPayload } from "jsonwebtoken";
import {
  db,
  getRoleByUserId,
  getUserById,
  getUserPrivacyByUserId,
  getUserShops,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import type { User } from "../types/user.ts";
import type { Role } from "../types/role.ts";
import type { Shop } from "../types/shop.ts";
import type { PrivacySettings } from "../types/privacySetting.ts";

export default function getUserInfo(user: JwtPayload | null): {
  user: User;
  role: Role;
  shops: Shop[];
  privacy: PrivacySettings[];
} {
  if (!user) {
    throw new HttpError(401, "User not found");
  }
  // get user info, roles and user shops from database
  const userInfo = getUserById(user.userId);
  if (!userInfo) {
    throw new HttpError(404, `User with userId ${user.userId} not found`);
  }
  const role = getRoleByUserId(user.userId);
  if (!role) {
    throw new HttpError(404, `Role with userId ${user.userId} not found`);
  }
  const userShops = getUserShops(user.userId);
  const userPrivacy = getUserPrivacyByUserId(user.userId);
  return {
    user: userInfo,
    role: role,
    shops: userShops,
    privacy: userPrivacy,
  };
}
