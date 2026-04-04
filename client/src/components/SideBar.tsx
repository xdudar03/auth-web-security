'use client';
import {
  ChartSpline,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  User,
  HistoryIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import MobileBottomBar from './MobileBottomBar';
import useJwt from '@/hooks/useJwt';
import { useQueryClient } from '@tanstack/react-query';
import { deleteActiveHpkeKey } from '@/lib/encryption/encryption';

export default function SideBar() {
  // get current path
  const [isActive, setIsActive] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const { role } = useUser();
  const { removeJwt } = useJwt();
  const queryClient = useQueryClient();
  const handleLogout = async () => {
    await deleteActiveHpkeKey();
    // Clear all cached queries to prevent showing stale user from previous session
    queryClient.clear();
    removeJwt();
    router.replace('/login');
  };
  useEffect(() => {
    setIsActive(pathname.split('/').pop() ?? '');
  }, [pathname]);
  console.log('isActive', isActive);
  console.log('role', role?.canAccessAdminPanel);
  return (
    <>
      {/* Mobile bottom bar */}
      {/* TODO: Come up with better dolution for mobile bottom bar (dont reuse code from desktop sidebar) */}
      <MobileBottomBar />

      {/* Desktop sidebar */}
      <div className="fixed top-0 left-0 bottom-0 sidebar-width p-4 hidden md:block">
        <div className="flex bg-surface rounded-lg flex-col gap-4 justify-between items-center p-2 lg:p-4 h-full">
          <div className="flex flex-col gap-2 lg:gap-4">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={`icon-btn-zoom ${
                isActive === 'dashboard' ||
                isActive === 'admin-dashboard' ||
                isActive === 'provider-dashboard'
                  ? 'active'
                  : ''
              }`}
            >
              <Link
                href={
                  role?.canAccessAdminPanel
                    ? '/admin-dashboard'
                    : role?.canAccessProviderPanel
                      ? '/provider-dashboard'
                      : '/dashboard'
                }
                aria-label="Dashboard"
              >
                <LayoutDashboard className="w-6 h-6" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={`icon-btn-zoom ${
                isActive === 'users-activity' ||
                isActive === 'shopping-history' ||
                isActive === 'shop-history'
                  ? 'active'
                  : ''
              }`}
            >
              <Link
                href={
                  role?.canAccessAdminPanel
                    ? '/users-activity'
                    : role?.canAccessProviderPanel
                      ? '/shop-history'
                      : '/shopping-history'
                }
                aria-label="Shopping History"
              >
                {role?.canAccessAdminPanel ? (
                  <HistoryIcon className="w-6 h-6" />
                ) : (
                  <ShoppingCart className="w-6 h-6" />
                )}
              </Link>
            </Button>
            {role?.canAccessProviderPanel ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={`icon-btn-zoom ${
                  isActive === 'shop-stats' ? 'active' : ''
                }`}
              >
                <Link href="/shop-stats" aria-label="Shop Stats">
                  <ChartSpline className="w-6 h-6" />
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={`icon-btn-zoom ${
                isActive === 'account' ? 'active' : ''
              }`}
            >
              <Link href="/account" aria-label="Profile">
                <User className="w-6 h-6" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={`icon-btn-zoom ${
                isActive === 'settings' ? 'active' : ''
              }`}
            >
              <Link href="/settings" aria-label="Settings">
                <Settings className="w-6 h-6" />
              </Link>
            </Button>
          </div>
          <Button
            aria-label="Logout"
            className="icon-btn-zoom"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
          >
            <LogOut className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </>
  );
}
