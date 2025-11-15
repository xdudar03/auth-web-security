import { z } from "zod";

// Transform SQLite integers (1/0) to booleans
const sqliteBoolean = z
  .union([z.boolean(), z.number()])
  .transform((val) => Boolean(val));

export const Role = z.object({
  roleId: z.number(),
  roleName: z.string(),
  canChangeUsersCredentials: sqliteBoolean,
  canChangeUsersRoles: sqliteBoolean,
  canReadUsers: sqliteBoolean,
  canReadUsersCredentials: sqliteBoolean,
  canReadUsersSettings: sqliteBoolean,
  canReadUsersRoles: sqliteBoolean,
  canAccessAdminPanel: sqliteBoolean,
  canAccessUserPanel: sqliteBoolean,
  canAccessProviderPanel: sqliteBoolean,
  hasGlobalAccessToAllShops: sqliteBoolean,
});

export type Role = z.infer<typeof Role>;
