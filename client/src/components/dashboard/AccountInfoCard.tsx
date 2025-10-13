'use client';
import { User } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import Link from 'next/link';

export default function AccountInfoCard() {
  const { user } = useUser();
  return (
    <div className="col-span-1 bg-surface rounded-lg h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 box-border">
        {/* User photo */}
        <div className="flex items-center justify-center gap-2 p-2 w-full mx-auto muted-panel h-40 md:h-2/3">
          <Link
            href="/account"
            className="icon-btn-zoom bg-transparent rounded-full w-full h-full flex items-center justify-center"
          >
            <User className="w-1/2 h-1/2 text-muted" />
          </Link>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-h-0 box-border p-2 ">
          <h3 className="text-lg font-semibold text-center">Account Info</h3>
          <p className="text-sm text-muted-foreground">
            Username: {user?.username}
          </p>
          <p className="text-sm text-muted-foreground">Full name: Full Name</p>
          <p className="text-sm text-muted-foreground">Email: Email</p>
        </div>
      </div>
    </div>
  );
}
