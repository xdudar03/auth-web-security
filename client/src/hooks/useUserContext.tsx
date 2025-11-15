'use client';
import { createContext, useContext } from 'react';
import { useTRPC } from './TrpcContext';
import { useQuery } from '@tanstack/react-query';
import useJwt from './useJwt';
import type { User } from '../../../server/src/types/user.ts';
import type { Role } from '../../../server/src/types/role.ts';
import type { PrivacySettings } from '../../../server/src/types/privacySetting.ts';
import type { Shop } from '../../../server/src/types/shop.ts';

export type { PrivacySettings, Role, User, Shop };

export const UserContext = createContext<
  | {
      isAuthenticated: boolean;
      user: User | null;
      role: Role | null;
      shops: Shop[] | null;
      privacy: PrivacySettings[] | null;
      isLoading: boolean;
      isPending: boolean;
    }
  | undefined
>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const trpc = useTRPC();
  const { jwt } = useJwt();
  const getUserInfoQuery = useQuery({
    ...trpc.info.getUserInfo.queryOptions(),
    enabled: Boolean(jwt),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  }); // only fetch when authenticated
  console.log('getUserInfoQuery', getUserInfoQuery);

  const user = getUserInfoQuery.data?.user ?? null;
  console.log('user in context', user);
  const role = getUserInfoQuery.data?.role ?? null;
  const shops = getUserInfoQuery.data?.shops ?? null;
  const privacy = getUserInfoQuery.data?.privacy ?? null;
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
        privacy,
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
