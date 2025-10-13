'use client';
import { LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';

export default function SideBar() {
  // get current path
  const [isActive, setIsActive] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const { setUser, setIsAuthenticated, role } = useUser();
  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    router.push('/');
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
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-4 py-2 flex md:hidden items-center justify-around">
        <Link
          href={!!role?.canAccessAdminPanel ? '/admin-dashboard' : '/dashboard'}
          className={`icon-btn ${isActive === 'dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-6 h-6" />
        </Link>
        <Link
          className={`icon-btn ${isActive === 'account' ? 'active' : ''}`}
          href="/account"
        >
          <User className="w-6 h-6" />
        </Link>
        <Link
          className={`icon-btn ${isActive === 'settings' ? 'active' : ''}`}
          href="/settings"
        >
          <Settings className="w-6 h-6" />
        </Link>
        <button aria-label="Logout" className="icon-btn" onClick={handleLogout}>
          <LogOut className="w-6 h-6" />
        </button>
      </nav>

      {/* Desktop sidebar */}
      <div className="fixed top-0 left-0 bottom-0 sidebar-width p-4 hidden md:block">
        <div className="flex bg-surface rounded-lg flex-col gap-4 justify-between items-center p-2 lg:p-4 h-full">
          <div className="flex flex-col gap-2 lg:gap-4">
            <Link
              href={
                !!role?.canAccessAdminPanel ? '/admin-dashboard' : '/dashboard'
              }
              aria-label="Dashboard"
              className={`icon-btn-zoom ${
                isActive === 'dashboard' || isActive === 'admin-dashboard'
                  ? 'active'
                  : ''
              }`}
            >
              <LayoutDashboard className="w-6 h-6" />
            </Link>
            <Link
              href="/account"
              aria-label="Profile"
              className={`icon-btn-zoom ${
                isActive === 'account' ? 'active' : ''
              }`}
            >
              <User className="w-6 h-6" />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className={`icon-btn-zoom ${
                isActive === 'settings' ? 'active' : ''
              }`}
            >
              <Settings className="w-6 h-6" />
            </Link>
          </div>
          <button
            aria-label="Logout"
            className="icon-btn-zoom"
            onClick={handleLogout}
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
}
