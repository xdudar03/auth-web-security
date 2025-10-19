'use client';
import { Activity, Users } from 'lucide-react';
import AccountStatsCard from './AccountStatsCard';
import SettingsCard from '../dashboard/SettingsCard';
import StatCard from './StatCard';
import UsersTable from './UsersTable';
import { useState } from 'react';
import { User } from '@/hooks/useUserContext';
import UserInfoModal from './UserInfoModal';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';

export default function AdminDashboard() {
  const trpc = useTRPC();
  const listUsersQuery = useQuery(trpc.admin.listUsers.queryOptions());
  console.log('listUsersQuery', listUsersQuery);
  const users = listUsersQuery.data?.users || [];
  console.log('users', users);
  const isLoading = listUsersQuery.isLoading;
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  console.log('showUserInfoModal', showUserInfoModal);
  console.log('activeUser', activeUser);
  console.log('mode', mode);

  return (
    <div className="grid w-full gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
      <SettingsCard />
      <StatCard
        title="Total Users"
        value={isLoading ? '…' : users.length.toString()}
        icon={<Users className="w-1/2 h-1/2 text-muted" />}
      />
      <StatCard
        title="Active Now"
        value="—"
        icon={<Activity className="w-1/2 h-1/2 text-success" />}
      />
      <AccountStatsCard />
      <UsersTable
        setShowUserInfoModal={setShowUserInfoModal}
        users={users}
        activeUser={activeUser as User}
        setActiveUser={setActiveUser}
        setMode={setMode}
      />
      {showUserInfoModal && activeUser && (
        <UserInfoModal
          activeUser={activeUser as User}
          setShowUserInfoModal={setShowUserInfoModal}
          setActiveUser={setActiveUser}
          mode={mode}
          setMode={setMode}
        />
      )}
    </div>
  );
}
