'use client';
import { User } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import {
  loadDecryptedUser,
  DecryptedPrivateProfile,
} from '@/lib/loadDecrypted';

export default function AccountInfoCard() {
  const { user, privateData } = useUser();
  const [decryptedData, setDecryptedData] =
    useState<DecryptedPrivateProfile | null>(null);

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!user || !privateData) {
        setDecryptedData(null);
        return;
      }
      const decryptedData = await loadDecryptedUser(user, privateData);
      if (!decryptedData) {
        return;
      }
      setDecryptedData(decryptedData);
    };
    void loadDecryptedData();
  }, [privateData, user]);

  console.log('decryptedData', decryptedData);
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
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              Username: {decryptedData?.username ?? '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              Full name: {decryptedData?.firstName ?? '-'}{' '}
              {decryptedData?.lastName ?? '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              Email: {decryptedData?.email ?? '-'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
