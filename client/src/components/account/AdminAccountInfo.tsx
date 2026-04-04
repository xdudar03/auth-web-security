'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/hooks/useUserContext';
import { Badge } from '../ui/badge';
import { Briefcase, Shield, User as UserIcon } from 'lucide-react';
import {
  DecryptedPrivateProfile,
  loadDecryptedUser,
} from '@/lib/encryption/loadDecrypted';

const permissionLabel = (permissionKey: string) =>
  permissionKey
    .replace(/^(can|has)/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();

export default function AdminAccountInfo() {
  const { user, role, privateData } = useUser();
  const [decryptedData, setDecryptedData] =
    useState<DecryptedPrivateProfile | null>(null);

  useEffect(() => {
    const loadDecryptedData = async () => {
      if (!user || !privateData) {
        setDecryptedData(null);
        return;
      }
      const decryptedData = await loadDecryptedUser(user, privateData);
      setDecryptedData(decryptedData);
    };
    void loadDecryptedData();
  }, [privateData, user]);

  console.log('decryptedData', decryptedData);

  const displayName = useMemo(() => {
    return (
      decryptedData?.firstName?.trim() ??
      decryptedData?.lastName?.trim() ??
      decryptedData?.username?.trim() ??
      '-'
    );
  }, [decryptedData]);

  const workEmail = decryptedData?.email ?? '-';
  const workArea = 'Platform Operations';
  const roleName = role?.roleName ?? '-';

  const permissions = useMemo(() => {
    if (!role) return [];

    return Object.entries(role)
      .filter(([key, value]) => {
        if (key === 'roleId' || key === 'roleName') {
          return false;
        }
        return typeof value === 'boolean' && value;
      })
      .map(([key]) => permissionLabel(key));
  }, [role]);

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div>
        <h1 className="text-2xl font-bold mb-4">Admin Account</h1>
        <div className="flex items-center justify-start flex-row gap-3 w-full">
          <UserIcon className="avatar-lg" />
          <div className="flex items-start justify-start flex-col gap-2">
            <p className="text-sm text-foreground font-bold">
              Name: {displayName}
            </p>
            <p className="text-sm text-foreground font-bold">
              Role: {roleName}
            </p>
          </div>
        </div>
      </div>

      <div className="grid-section-2 w-full">
        <div className="col-span-2 rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Work
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Work Email
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground break-all">
                {workEmail}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Work Area
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {workArea}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-2 rounded-lg border border-border/50 bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Permissions
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.length ? (
              permissions.map((permission) => (
                <Badge key={permission} variant="outline">
                  {permission}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No explicit permissions assigned.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
