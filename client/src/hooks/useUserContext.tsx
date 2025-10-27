'use client';
import { createContext, useContext } from 'react';
import { useTRPC } from './TrpcContext';
import { useQuery } from '@tanstack/react-query';
import useJwt from './useJwt';

export const UserContext = createContext<
  | {
      isAuthenticated: boolean;
      user: User | null;
      role: Role | null;
      shops: Shop[] | null;
      isLoading: boolean;
      isPending: boolean;
    }
  | undefined
>(undefined);

export type User = {
  userId: string;
  username: string;
  password: string;
  embedding?: number[] | null;
  roleId?: number | null;
  credentials?: unknown | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
};

export type Shop = {
  shopId: number;
  shopName: string;
  shopAddress: string;
  shopDescription: string;
  shopOwnerId?: number;
};

export type Role = {
  roleId: number;
  roleName: string;
  canChangeUsersCredentials: boolean;
  canChangeUsersRoles: boolean;
  canReadUsers: boolean;
  canReadUsersCredentials: boolean;
  canReadUsersSettings: boolean;
  canReadUsersRoles: boolean;
  canAccessAdminPanel: boolean;
  canAccessUserPanel: boolean;
  canAccessProviderPanel: boolean;
  hasGlobalAccessToAllShops: boolean;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const trpc = useTRPC();
  const { jwt } = useJwt();
  const getUserInfoQuery = useQuery({
    ...trpc.info.getUserInfo.queryOptions(),
    enabled: Boolean(jwt),
  }); // only fetch when authenticated
  console.log('getUserInfoQuery', getUserInfoQuery);

  const user = getUserInfoQuery.data?.user ?? null;
  const role = getUserInfoQuery.data?.role ?? null;
  const shops = getUserInfoQuery.data?.shops ?? null;
  const isAuthenticated = getUserInfoQuery.isSuccess;

  const isLoading = getUserInfoQuery.isLoading;
  const isPending = getUserInfoQuery.isPending;

  // console.log('user in context', user);
  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated,
        role,
        shops,
        isLoading,
        isPending,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  // console.log('context', context);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
