export function mapResponseQuery(query: any) {
  const response = {
    user: {
      userId: query.userId,
      username: query.username,
      password: query.password,
      roleId: query.roleId,
      registered: query.registered ?? 1,
      credentials: query.credentials,
      email: query.email,
      firstName: query.firstName,
      lastName: query.lastName,
      isBiometric: query.isBiometric,
      MFAEnabled: query.MFAEnabled,
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
    privacy: query.privacy || {
      firstName: "hidden",
      lastName: "hidden",
      email: "hidden",
      phoneNumber: "hidden",
      dateOfBirth: "hidden",
      gender: "hidden",
      address: "hidden",
    },
  };
  return response;
}
