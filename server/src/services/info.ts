import type { JwtPayload } from "jsonwebtoken";
import {
  getRoleByUserId,
  getUserById,
  getUserPrivateDataByUserId,
  getUserPrivacyByUserId,
  getUserShops,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import type {
  User,
  UserPrivateData as UserPrivateDataType,
} from "../types/user.ts";
import type { Role } from "../types/role.ts";
import type { Shop } from "../types/shop.ts";
import type { PrivacySettings } from "../types/privacySetting.ts";

function buildEncryptedOnlyBaseUser(user: User): User {
  const redactCredentials = (raw: string | null | undefined): string | null => {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return null;
      }

      const redacted = parsed.map((value) => {
        const credential = (value ?? {}) as Record<string, unknown>;
        return {
          credentialID:
            typeof credential.credentialID === "string"
              ? credential.credentialID
              : null,
          counter:
            typeof credential.counter === "number" ? credential.counter : null,
          transports: Array.isArray(credential.transports)
            ? credential.transports.filter(
                (transport): transport is string => typeof transport === "string",
              )
            : [],
          credentialDeviceType:
            typeof credential.credentialDeviceType === "string"
              ? credential.credentialDeviceType
              : null,
          credentialBackedUp:
            typeof credential.credentialBackedUp === "boolean"
              ? credential.credentialBackedUp
              : null,
          hasWrappedPrivateKey: Boolean(credential.wrappedPrivateKey),
        };
      });

      return JSON.stringify(redacted);
    } catch {
      return null;
    }
  };

  return {
    userId: user.userId,
    hpkePublicKeyB64: user.hpkePublicKeyB64 ?? null,
    recoverySaltB64: user.recoverySaltB64 ?? null,
    encryptedPrivateKey: user.encryptedPrivateKey ?? null,
    encryptedPrivateKeyIv: user.encryptedPrivateKeyIv ?? null,
    emailHash: null,
    username: "",
    password: "",
    roleId: user.roleId ?? null,
    credentials: redactCredentials(user.credentials),
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    isBiometric: user.isBiometric ?? false,
    MFAEnabled: user.MFAEnabled ?? false,
    registered: user.registered,
    phoneNumber: user.phoneNumber ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    gender: user.gender ?? null,
    address: user.address ?? null,
    city: user.city ?? null,
    state: user.state ?? null,
    zip: user.zip ?? null,
    country: user.country ?? null,
    spendings: user.spendings ?? null,
    shoppingHistory: null,
    privacy: user.privacy,
    privacyPreset: user.privacyPreset ?? null,
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
  const originalEncapPubKey = userPrivateData?.original_encap_pubkey ?? null;
  const hasPrivateData = Boolean(originalCipher && originalIv && originalEncapPubKey);
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
