import { useUser } from '@/hooks/useUserContext';
import { LayoutDashboard, User, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn ${isActive === 'dashboard' ? 'active' : ''}`}
      >
        <Link
          href={!!role?.canAccessAdminPanel ? '/admin-dashboard' : '/dashboard'}
        >
          <LayoutDashboard className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn ${isActive === 'account' ? 'active' : ''}`}
      >
        <Link href="/account">
          <User className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={`icon-btn ${isActive === 'settings' ? 'active' : ''}`}
      >
        <Link href="/settings">
          <Settings className="w-6 h-6" />
        </Link>
      </Button>
      <Button
        aria-label="Logout"
        variant="ghost"
        size="icon"
        onClick={handleLogout}
      >
        <LogOut className="w-6 h-6" />
      </Button>
    </nav>
  );
}
