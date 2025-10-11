'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUserContext';

type ProtectedProps = {
  children: React.ReactNode;
  requireRoles?: number[]; // optional role IDs allowed to access
  fallback?: React.ReactNode; // optional fallback while redirecting
};

export default function Protected({
  children,
  requireRoles,
  fallback,
}: ProtectedProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useUser();

  const isAuthorized = (() => {
    if (!requireRoles || requireRoles.length === 0) return true;
    if (!user?.roleId) return false;
    return requireRoles.includes(user.roleId);
  })();

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) {
      router.replace('/login');
    }
  }, [isAuthenticated, isAuthorized, router]);

  if (!isAuthenticated || !isAuthorized) {
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
