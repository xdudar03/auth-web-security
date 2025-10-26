import fs from "fs";
import { USERS_FILE_TEMP } from "./config.ts";

export function mapResponseQuery(query: any) {
  const response = {
    user: {
      userId: query.userId,
      username: query.username,
      password: query.password,
      embedding: query.embedding,
      roleId: query.roleId,
      credentials: query.credentials,
      email: query.email,
      firstName: query.firstName,
      lastName: query.lastName,
      phoneNumber: query.phoneNumber,
      dateOfBirth: query.dateOfBirth,
    },
    role: {
      roleId: query.roleId,
      roleName: query.roleName,
      canChangeUsersCredentials: query.canChangeUsersCredentials,
      canChangeUsersRoles: query.canChangeUsersRoles,
      canReadUsers: query.canReadUsers,
      canReadUsersCredentials: query.canReadUsersCredentials,
      canReadUsersSettings: query.canReadUsersSettings,
      canReadUsersRoles: query.canReadUsersRoles,
      canAccessAdminPanel: query.canAccessAdminPanel,
      canAccessUserPanel: query.canAccessUserPanel,
      canAccessProviderPanel: query.canAccessProviderPanel,
      hasGlobalAccessToAllShops: query.hasGlobalAccessToAllShops,
    },
    shops: Array.isArray(query.shops)
      ? query.shops.map((s: any) => ({
          shopId: s.shopId,
          shopName: s.shopName,
          shopAddress: s.shopAddress,
          shopDescription: s.shopDescription,
          shopOwnerId: s.shopOwnerId,
        }))
      : [],
  };
  return response;
}

export function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE_TEMP)) return [];
    const users = JSON.parse(fs.readFileSync(USERS_FILE_TEMP, "utf8"));
    return users;
  } catch (err) {
    console.warn("Failed to load users from file:", err);
    return [];
  }
}

export function saveUsers(users: any) {
  fs.writeFileSync(USERS_FILE_TEMP, JSON.stringify(users, null, 2));
}
