import {
  db,
  getUserPrivacyByUserId,
  getUserShops,
  getUserWithRoleQuery,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import { mapResponseQuery } from "../utils.ts";

export function sanitizeUserSummary(row: any) {
  const shops = getUserShops(row?.userId as string);
  const privacy = getUserPrivacyByUserId(row?.userId as string).reduce(
    (acc: Record<string, string>, p: any) => {
      acc[p.field] = p.visibility;
      return acc;
    },
    {},
  );

  const result = mapResponseQuery({
    ...row,
    shops,
    privacy,
  });
  const { user, role, shops: mappedShops, privacy: mappedPrivacy } = result;

  const { credentials, password, ...safeUser } = user;
  const {
    canChangeUsersCredentials,
    canChangeUsersRoles,
    canReadUsers,
    canReadUsersCredentials,
    canReadUsersSettings,
    canReadUsersRoles,
    canAccessAdminPanel,
    canAccessUserPanel,
    canAccessProviderPanel,
    hasGlobalAccessToAllShops,
    ...safeRole
  } = role;

  return {
    user: safeUser,
    role: safeRole,
    shops: mappedShops,
    privacy: mappedPrivacy,
  };
}

export function listUsers() {
  const usersFromDB = db
    .prepare("SELECT * FROM users JOIN roles ON roles.roleId = users.roleId")
    .all();

  const response = usersFromDB.map((row: any) => sanitizeUserSummary(row));

  return {
    users: response,
  };
}

export function getUserWithRoleById(id: string) {
  const row = getUserWithRoleQuery.get(id);

  if (!row) {
    throw new HttpError(404, "User not found");
  }
  const shops = getUserShops(row?.userId as string);
  const response = mapResponseQuery({
    ...row,
    shops,
  });
  return {
    user: response.user,
    role: response.role,
  };
}
