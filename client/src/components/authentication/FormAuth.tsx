'use client';

// import { useEffect } from 'react';
import { handleAuthenticatePasswordless } from '@/lib/authentication/authenticationPasswordless';
import { Role, useUser, type User } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/authentication/registration';
import { useRouter } from 'next/navigation';
import { handleAuthenticate } from '@/lib/authentication/authentication';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
export default function FormAuth({
  setTab,
  title,
}: {
  setTab: (tab: string) => void;
  title: string;
}) {
  const { user, setUser, setIsAuthenticated, setRole } = useUser();
  const router = useRouter();
  // useEffect(() => {
  //   console.log('user updated', user);
  // }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('submitting users', user);
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    if (user?.password === '') {
      alert('Password is required');
      return;
    }
    if (title === 'Registration') {
      const id = crypto.randomUUID(); // TODO: generate id from server
      const userWithId = { ...(user ?? {}), id: id, roleId: 2 } as User;
      const result = await handleRegister(userWithId);
      if (result) {
        setUser(result.user as User);
        setRole(result.role as Role);
        setIsAuthenticated(true);
        if (result.role.canAccessAdminPanel) {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    } else {
      const resultUser = await handleAuthenticate(user as User);
      console.log('resultUser', resultUser);
      if (resultUser) {
        setIsAuthenticated(true);
        setUser(resultUser.user as User);
        setRole(resultUser.role as Role);
        if (resultUser.role.canAccessAdminPanel) {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'username') {
      setUser({ ...(user ?? {}), username: value } as User);
    } else if (name === 'password') {
      setUser({ ...(user ?? {}), password: value } as User);
    }
  };

  const handlePasswordless = async () => {
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    if (user?.username) {
      const result = await handleAuthenticatePasswordless(
        user.username,
        user.id
      );
      if (result.user) {
        setUser(result.user as User);
        setRole(result.role as Role);
        setIsAuthenticated(true);
        if (result.role.canAccessAdminPanel) {
          router.push('/admin-dashboard');
        } else {
          router.push('/dashboard');
        }
      }
    } else {
      alert('Username is required');
    }
  };

  const handleBiometric = () => {
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    setTab('multi-factor');
  };
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded gap-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <form onSubmit={onSubmit} className="form">
        <div className="form-field">
          <Label htmlFor="username" className="form-label">
            Username
          </Label>
          <Input
            id="username"
            type="text"
            name="username"
            onChange={handleChange}
            placeholder="Enter your username"
            autoComplete="username"
          />
        </div>
        <div className="form-field">
          <Label htmlFor="password" className="form-label">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            name="password"
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete={
              title === 'Registration' ? 'new-password' : 'current-password'
            }
          />
          <span className="helper-text">
            Use at least 8 characters, including a number and a symbol.
          </span>
        </div>
        <div className="flex items-center justify-between flex-col gap-2">
          {title === 'Login' && (
            <Button
              type="button"
              variant="link"
              className="shadow-none self-center w-full"
              onClick={handlePasswordless}
            >
              Use passwordless {title.toLowerCase()}
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            className="shadow-none self-center w-full"
            onClick={handleBiometric}
          >
            Use biometric {title.toLowerCase()}
          </Button>
          <Button type="submit" className="w-full">
            {title}
          </Button>
        </div>
      </form>
    </div>
  );
}
