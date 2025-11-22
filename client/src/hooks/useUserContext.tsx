'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useTRPC } from './TrpcContext';
import { useQuery } from '@tanstack/react-query';
import useJwt from './useJwt';
import type { User } from '../../../server/src/types/user.ts';
import type { Role } from '../../../server/src/types/role.ts';
import type {
  PrivacySettings,
  Visibility,
} from '../../../server/src/types/privacySetting.ts';
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
      privacyPreset: Record<string, Visibility> | null;
      setPrivacyPreset: (preset: Record<string, Visibility>) => void;
    }
  | undefined
>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const trpc = useTRPC();
  const { jwt } = useJwt();
  // default privacy preset is pl4 which is the highest privacy level
  const getDefaultPrivacyPresetQuery = useQuery({
    ...trpc.privacy.getPrivacyPreset.queryOptions({ preset: 'pl4' }),
    enabled: Boolean(jwt),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const defaultPrivacyPreset = getDefaultPrivacyPresetQuery.data ?? null;
  const [privacyPreset, setPrivacyPreset] = useState<Record<
    string,
    Visibility
  > | null>(defaultPrivacyPreset);

  useEffect(() => {
    if (defaultPrivacyPreset) {
      setPrivacyPreset(defaultPrivacyPreset);
    }
  }, [defaultPrivacyPreset, setPrivacyPreset]);

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
        privacyPreset,
        setPrivacyPreset,
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
