'use client';
import { createContext, useContext, useState } from 'react';

export const UserContext = createContext<
  | {
      isAuthenticated: boolean;
      setIsAuthenticated: (isAuthenticated: boolean) => void;
      user: User | null;
      setUser: (user: User | null) => void;
    }
  | undefined
>(undefined);

export type User = {
  id: string;
  username: string;
  password: string;
  embedding?: string;
  roleId?: number;
  credentials?: any;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // console.log('user in context', user);
  return (
    <UserContext.Provider
      value={{ user, setUser, isAuthenticated, setIsAuthenticated }}
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
