'use client';
import { User } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import {
  decryptWithHpkePrivateKey,
  getActiveHpkePrivateKeyJwkB64,
  getUserHpkeBundleByPublicKey,
  importHpkePrivateKeyJwkB64,
  setActiveHpkePrivateKey,
  setActiveHpkePublicKey,
} from '@/lib/encryption';
import { useEffect, useState } from 'react';

type DecryptedPrivateProfile = {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  [key: string]: unknown;
};

export default function AccountInfoCard() {
  const { user, privateData } = useUser();
  const [decryptedData, setDecryptedData] = useState<DecryptedPrivateProfile>({
    username: '',
    email: '',
  });
  const [isProfileLocked, setIsProfileLocked] = useState(false);

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!privateData || !user?.hpkePublicKeyB64) {
        setDecryptedData({ username: '', email: '' });
        setIsProfileLocked(false);
        return;
      }

      if (
        !privateData.original_cipher ||
        !privateData.original_iv ||
        !privateData.original_encap_pubkey
      ) {
        setDecryptedData({ username: '', email: '' });
        setIsProfileLocked(false);
        return;
      }

      try {
        let privateKeyJwkB64 = await getActiveHpkePrivateKeyJwkB64();
        if (!privateKeyJwkB64) {
          const matchedBundle = await getUserHpkeBundleByPublicKey(
            user.hpkePublicKeyB64
          );
          if (matchedBundle) {
            await setActiveHpkePrivateKey(matchedBundle.privateKeyJwkB64);
            await setActiveHpkePublicKey(matchedBundle.publicKeyB64);
            privateKeyJwkB64 = matchedBundle.privateKeyJwkB64;
          }
        }

        if (!privateKeyJwkB64) {
          setDecryptedData({ username: '', email: '' });
          setIsProfileLocked(true);
          return;
        }
        const privateKey = await importHpkePrivateKeyJwkB64(privateKeyJwkB64);
        const decrypted = await decryptWithHpkePrivateKey(
          privateKey,
          privateData.original_cipher,
          privateData.original_iv,
          privateData.original_encap_pubkey
        );

        try {
          const parsed = JSON.parse(decrypted) as DecryptedPrivateProfile;
          setDecryptedData(parsed);
          setIsProfileLocked(false);
        } catch {
          setDecryptedData({ username: '', email: decrypted });
          setIsProfileLocked(false);
        }
      } catch (error) {
        console.error('Failed to decrypt account data', error);
        setDecryptedData({ username: '', email: '' });
        setIsProfileLocked(true);
      }
    };

    void loadDecryptedData();
  }, [privateData, user?.hpkePublicKeyB64]);

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
          <p className="text-sm text-muted-foreground">
            Username: {decryptedData.username}
          </p>
          <p className="text-sm text-muted-foreground">
            Full name: {decryptedData?.firstName ?? '-'}{' '}
            {decryptedData?.lastName ?? ''}
          </p>
          <p className="text-sm text-muted-foreground">
            Email: {decryptedData?.email ?? '-'}
          </p>
          {isProfileLocked && (
            <p className="text-sm text-warning mt-2">
              Encrypted profile is locked on this device. Sign in with your
              recovery passphrase once to restore access.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
