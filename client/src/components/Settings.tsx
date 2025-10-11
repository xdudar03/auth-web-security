'use client';
import { useUser } from '@/hooks/useUserContext';
import PairedDeviceTable from './PairedDeviceTable';
import SecuritySettings from './SecuritySettings';

export default function Settings() {
  const { user } = useUser();
  const roles = [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'User' },
    { id: 3, name: 'Shop Owner' },
  ];

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p>User Role: {roles.find((role) => role.id === user?.roleId)?.name}</p>
      <SecuritySettings />
      <PairedDeviceTable />
    </div>
  );
}
