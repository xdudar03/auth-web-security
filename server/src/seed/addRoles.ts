import { addRole } from "../database.ts";

const addHardcodedRoles = () => {
  addRole({
    roleName: "admin",
    canChangeUsersCredentials: true,
    canChangeUsersRoles: true,
    canReadUsers: true,
    canReadUsersCredentials: true,
    canReadUsersSettings: true,
    canReadUsersRoles: true,
    canAccessAdminPanel: true,
    canAccessUserPanel: true,
    canAccessProviderPanel: false,
    hasGlobalAccessToAllShops: true,
  });

  addRole({
    roleName: "user",
    canChangeUsersCredentials: false,
    canChangeUsersRoles: false,
    canReadUsers: true,
    canReadUsersCredentials: false,
    canReadUsersSettings: false,
    canReadUsersRoles: false,
    canAccessAdminPanel: false,
    canAccessUserPanel: true,
    canAccessProviderPanel: false,
    hasGlobalAccessToAllShops: false,
  });

  addRole({
    roleName: "provider",
    canChangeUsersCredentials: false,
    canChangeUsersRoles: false,
    canReadUsers: false,
    canReadUsersCredentials: false,
    canReadUsersSettings: false,
    canReadUsersRoles: false,
    canAccessAdminPanel: false,
    canAccessUserPanel: false,
    canAccessProviderPanel: true,
    hasGlobalAccessToAllShops: false,
  });
};

addHardcodedRoles();
