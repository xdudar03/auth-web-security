import type { JwtPayload } from "jsonwebtoken";
import {
  getRoleByUserId,
  getUserById,
  getUserPrivateDataByUserId,
  getUserPrivacyByUserId,
  getUserShops,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import type { User, UserPrivateData as UserPrivateDataType } from "../types/user.ts";
import type { Role } from "../types/role.ts";
import type { Shop } from "../types/shop.ts";
import type { PrivacySettings } from "../types/privacySetting.ts";

function buildEncryptedOnlyBaseUser(user: User): User {
  return {
    ...user,
    username: "",
    email: "",
    firstName: null,
    lastName: null,
    phoneNumber: null,
    dateOfBirth: null,
    gender: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    country: null,
    spendings: null,
    shoppingHistory: null,
  };
}

export default async function getUserInfo(user: JwtPayload | null): Promise<{
  user: User;
  role: Role;
  shops: Shop[];
  privacy: PrivacySettings[];
  hasPrivateData: boolean;
  privateData: UserPrivateDataType | null;
}> {
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
  const userPrivateData = getUserPrivateDataByUserId(user.userId);
  const originalCipher = userPrivateData?.original_cipher ?? null;
  const originalIv = userPrivateData?.original_iv ?? null;
  const hasPrivateData = Boolean(originalCipher && originalIv);
  const resolvedUserInfo = buildEncryptedOnlyBaseUser(userInfo);

  return {
    user: resolvedUserInfo,
    role: role,
    shops: userShops,
    privacy: userPrivacy,
    hasPrivateData,
    privateData: userPrivateData,
  };
}
