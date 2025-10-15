'use client';
import { Settings, TriangleAlert } from 'lucide-react';
import { useUser } from '@/hooks/useUserContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '../ui/card';

export default function SettingsCard() {
  const { user } = useUser();
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardHeader>
          <Link
            href="/settings"
            className="icon-btn-zoom bg-transparent rounded-full w-full h-full flex items-center justify-center"
          >
            <Settings className=" w-full h-1/2 text-muted" />
          </Link>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold text-center">Settings</h3>
          {user?.embedding ? (
            <p className="settings-warning">Biometric data registered</p>
          ) : (
            <p className="settings-warning">
              <TriangleAlert className="w-4 h-4 text-warning" />
              Please register biometric data
            </p>
          )}
          {user?.credentials ? (
            <p className="settings-warning">Passkey is set</p>
          ) : (
            <p className="settings-warning">
              <TriangleAlert className="w-4 h-4 text-warning" />
              Please set passkey
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
