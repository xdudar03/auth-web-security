import { useUser } from '@/hooks/useUserContext';
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  ShoppingCart,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useJwt from '@/hooks/useJwt';
import { deleteActiveHpkeKey } from '@/lib/encryption';

export default function MobileBottomBar() {
  const [isActive, setIsActive] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const { role } = useUser();
  const queryClient = useQueryClient();
  const { removeJwt } = useJwt();
  const handleLogout = async () => {
    await deleteActiveHpkeKey();
    // Clear cache and token to avoid stale flashes
    queryClient.clear();
    removeJwt();
    router.push('/');
  };
  useEffect(() => {
    setIsActive(pathname.split('/').pop() ?? '');
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-4 py-2 flex md:hidden items-center justify-around">
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
      {role?.canAccessAdminPanel ? (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={`icon-btn-zoom ${
            isActive === 'users-table' ? 'active' : ''
          }`}
        >
          <Link href="/users-table" aria-label="Users Table">
            <Users className="w-6 h-6" />
          </Link>
        </Button>
      ) : null}
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn-zoom ${
          isActive === 'shopping-history' || isActive === 'shop-history'
            ? 'active'
            : ''
        }`}
      >
        <Link
          href={
            role?.canAccessProviderPanel ? '/shop-history' : '/shopping-history'
          }
          aria-label="Shopping History"
        >
          <ShoppingCart className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn-zoom ${isActive === 'account' ? 'active' : ''}`}
      >
        <Link href="/account" aria-label="Profile">
          <User className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn-zoom ${isActive === 'settings' ? 'active' : ''}`}
      >
        <Link href="/settings" aria-label="Settings">
          <Settings className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        aria-label="Logout"
        className="icon-btn-zoom"
        variant="ghost"
        size="icon"
        onClick={handleLogout}
      >
        <LogOut className="w-6 h-6" />
      </Button>
    </nav>
  );
}
