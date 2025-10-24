'use client';
import { createContext, useContext, useState } from 'react';

export const UserContext = createContext<
  | {
      isAuthenticated: boolean;
      setIsAuthenticated: (isAuthenticated: boolean) => void;
      user: User | null;
      setUser: (user: User | null) => void;
      role: Role | null;
      setRole: (role: Role | null) => void;
      shops: Shop[] | null;
      setShops: (shops: Shop[] | null) => void;
    }
  | undefined
>(undefined);

export type User = {
  userId: string;
  username: string;
  password: string;
  embedding?: number[] | null;
  roleId?: number | null;
  credentials?: any | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
};

export type Shop = {
  id: number;
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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [shops, setShops] = useState<Shop[] | null>(null);
  // console.log('user in context', user);
  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated,
        setIsAuthenticated,
        role,
        setRole,
        shops,
        setShops,
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
