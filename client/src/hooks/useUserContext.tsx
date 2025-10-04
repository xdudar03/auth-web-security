import { createContext, useContext, useState } from 'react';

export const UserContext = createContext<
  | {
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
  credentials?: any[];
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  console.log('user in context', user);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  console.log('context', context);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
