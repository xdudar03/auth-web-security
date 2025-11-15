import { z } from "zod";

export const Role = z.object({
  roleId: z.number(),
  roleName: z.string(),
  canChangeUsersCredentials: z.boolean(),
  canChangeUsersRoles: z.boolean(),
  canReadUsers: z.boolean(),
  canReadUsersCredentials: z.boolean(),
  canReadUsersSettings: z.boolean(),
  canReadUsersRoles: z.boolean(),
  canAccessAdminPanel: z.boolean(),
  canAccessUserPanel: z.boolean(),
  canAccessProviderPanel: z.boolean(),
  hasGlobalAccessToAllShops: z.boolean(),
});

export type Role = z.infer<typeof Role>;
