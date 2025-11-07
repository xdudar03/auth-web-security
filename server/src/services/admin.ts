import {
  db,
  getUserPrivacyByUserId,
  getUserShops,
  updateUser,
} from "../database.ts";
import { HttpError } from "../errors.ts";
import { mapResponseQuery } from "../utils.ts";

export function sanitizeUserSummary(row: any) {
  const shops = getUserShops.all(row?.userId as string);
  const privacy = getUserPrivacyByUserId
    .all(row?.userId as string)
    .reduce((acc: Record<string, string>, p: any) => {
      acc[p.field] = p.visibility;
      return acc;
    }, {});
  console.log(`privacy: ${row?.userId}`, privacy);

  const result = mapResponseQuery({
    ...row,
    shops,
    privacy,
  });
  const { user, role, shops: mappedShops, privacy: mappedPrivacy } = result;

  const { embedding, credentials, password, ...safeUser } = user;
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
  const row = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE users.userId = ?"
    )
    .get(id);

  if (!row) {
    throw new HttpError(404, "User not found");
  }
  const shops = getUserShops.all(row?.userId as string);
  const response = mapResponseQuery({
    ...row,
    shops,
  });
  return {
    user: response.user,
    role: response.role,
  };
}

type UpdateUserInput = {
  username?: string | null;
  email?: string | null;
  password?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  roleId?: number | string | null;
};

export function updateUserById(userId: string, updates: UpdateUserInput) {
  const existing = db
    .prepare("SELECT * FROM users WHERE userId = ?")
    .get(userId);

  console.log("existing: ", existing);

  if (!existing) {
    throw new HttpError(404, "User not found");
  }

  const preparedUpdates = { ...updates } as Record<string, any>;

  console.log("preparedUpdates: ", preparedUpdates);

  if (preparedUpdates.roleId !== undefined && preparedUpdates.roleId !== null) {
    preparedUpdates.roleId = Number(preparedUpdates.roleId);
  }

  const updatesToSave = Object.fromEntries(
    Object.entries(preparedUpdates).filter(([key, value]) => {
      if (value === undefined) return false;
      return existing[key] !== value;
    })
  );

  console.log("updatesToSave: ", updatesToSave);

  if (Object.keys(updatesToSave).length === 0) {
    throw new HttpError(400, "No updates to save");
  }

  updateUser(existing.userId as string, updatesToSave);
  const updatedRow = db
    .prepare(
      "SELECT * FROM users JOIN roles ON roles.roleId = users.roleId WHERE users.userId = ?"
    )
    .get(userId);

  if (!updatedRow) {
    throw new HttpError(500, "Failed to load updated user");
  }

  const shops = getUserShops.all(updatedRow?.userId as string);

  const response = mapResponseQuery({
    ...updatedRow,
    shops,
  });

  return {
    message: "User updated successfully",
    user: response.user,
    role: response.role,
  };
}
