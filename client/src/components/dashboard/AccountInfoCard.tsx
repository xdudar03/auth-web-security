'use client';
import { User } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function AccountInfoCard() {
  const { user } = useUser();
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardHeader>
          <Link
            href="/account"
            className="icon-btn-zoom bg-transparent rounded-full w-full h-full flex items-center justify-center"
          >
            <User className="w-1/2 h-1/2 text-muted" />
          </Link>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold text-center">Account Info</h3>
          <p className="text-sm text-muted-foreground">
            Username: {user?.username}
          </p>
          <p className="text-sm text-muted-foreground">
            Full name: {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-muted-foreground">Email: {user?.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
