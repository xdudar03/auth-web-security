'use client';

// import { useEffect } from 'react';
import { handleAuthenticatePasswordless } from '@/lib/authenticationPasswordless';
import { useUser, type User } from '@/hooks/useUserContext';
import { handleRegister } from '@/lib/registration';
import { useRouter } from 'next/navigation';
import { handleAuthenticate } from '@/lib/authentication';
export default function FormAuth({
  setTab,
  title,
}: {
  setTab: (tab: string) => void;
  title: string;
}) {
  const { user, setUser, setIsAuthenticated } = useUser();
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
        setUser(userWithId);
        setIsAuthenticated(true);
        router.push('/dashboard');
      }
    } else {
      const resultUser = await handleAuthenticate(user as User);
      if (resultUser) {
        setIsAuthenticated(true);
        setUser(resultUser as User);
        router.push('/dashboard');
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
        setUser(result.user);
        setIsAuthenticated(true);
        router.push('/dashboard');
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
          <label htmlFor="username" className="form-label">
            Username
          </label>
          <input
            id="username"
            type="text"
            name="username"
            onChange={handleChange}
            className="form-input"
            placeholder="Enter your username"
            autoComplete="username"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            onChange={handleChange}
            className="form-input"
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
            <button
              type="button"
              className="btn-link-muted shadow-none self-center w-full"
              onClick={handlePasswordless}
            >
              Use passwordless {title.toLowerCase()}
            </button>
          )}
          <button
            type="button"
            className="btn-link-muted shadow-none self-center w-full"
            onClick={handleBiometric}
          >
            Use biometric {title.toLowerCase()}
          </button>
          <button type="submit" className="btn-primary cursor-pointer w-full">
            {title}
          </button>
        </div>
      </form>
    </div>
  );
}
