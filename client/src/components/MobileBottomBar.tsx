import { useUser } from '@/hooks/useUserContext';
import { Link, LayoutDashboard, User, Settings, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MobileBottomBar() {
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-4 py-2 flex md:hidden items-center justify-around">
      {/* Mobile bottom bar */}
      {/* TODO: Come up with better dolution for mobile bottom bar (dont reuse code from desktop sidebar) */}
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
  );
}
