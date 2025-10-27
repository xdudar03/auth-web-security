'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUserContext';
import { Button } from '@/components/ui/button';

type ProtectedProps = {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallback?: React.ReactNode; // optional fallback while redirecting
};

export default function Protected({
  children,
  requiredPermissions,
  fallback,
}: ProtectedProps) {
  const router = useRouter();
  const { isAuthenticated, user, role, isLoading, isPending } = useUser();
  console.log('user', user);
  console.log('role', role);
  console.log('user?.roleId', user?.roleId);

  const isAuthorized = (() => {
    console.log('requiredPermissions', requiredPermissions);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    if (!user?.roleId || !role) return false;
    return requiredPermissions.every(
      (permission) => role[`${permission}` as keyof typeof role]
    );
  })();

  console.log('isAuthorized', isAuthorized);

  useEffect(() => {
    if (!isAuthenticated && !isLoading && !isPending) {
      router.replace('/login');
    }
  }, [isAuthenticated, router, isLoading, isPending]);

  if (isLoading || isPending) {
    return (
      <div className="center-screen">
        <div className="card">
          <p className="text-center text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="center-screen">
        <div className="card">
          <p className="text-center text-muted">
            You are not authorized to access this page
          </p>
          <Button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      fallback ?? (
        <div className="center-screen">
          <div className="card">
            <p className="text-center text-muted">Redirecting to login…</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
