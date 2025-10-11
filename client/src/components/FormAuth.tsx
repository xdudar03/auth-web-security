'use client';

// import { useEffect } from 'react';
import { handleRegisterPasswordless } from '@/lib/registrationPasswordless';
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
      if (resultUser && resultUser.embedding === '') {
        setIsAuthenticated(true);
        setUser(resultUser as User);
        router.push('/dashboard');
      } else {
        setTab('multi-factor');
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

  const handlePasswordless = () => {
    if (user?.username === '') {
      alert('Username is required');
      return;
    }
    if (title === 'Registration') {
      const id = crypto.randomUUID(); // TODO: generate id from server
      console.log('id', id);
      setUser({ ...(user ?? {}), id: id, roleId: 2 } as User);
      if (user?.username) {
        handleRegisterPasswordless(user.username, user.credentials, id);
      } else {
        alert('Username is required');
      }
    } else {
      if (user?.username) {
        handleAuthenticatePasswordless(user.username, user.id);
      } else {
        alert('Username is required');
      }
    }
  };
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface rounded  gap-6">
      <h2 className="text-lg font-semibold">{title} Form</h2>
      <form onSubmit={onSubmit} className="flex flex-col space-y-4">
        <label>
          <input
            type="text"
            name="username"
            onChange={handleChange}
            className="input"
            placeholder="Username"
          />
        </label>
        <label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
            className="input"
            placeholder="Password"
          />
        </label>
        <button
          type="button"
          className="btn-link-muted shadow-none self-center"
          onClick={handlePasswordless}
        >
          Use passwordless {title.toLowerCase()}
        </button>
        <button type="submit" className="btn-primary cursor-pointer">
          {title}
        </button>
      </form>
    </div>
  );
}
