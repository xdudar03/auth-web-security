'use client';
import { Activity, Users } from 'lucide-react';
import AccountStatsCard from './AccountStatsCard';
import SettingsCard from '../dashboard/SettingsCard';
import StatCard from './StatCard';
import UsersTable from '../UsersTable';
import { useState } from 'react';
import { Role, Shop, User } from '@/hooks/useUserContext';
import UserInfoModal from './UserInfoModal';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';

export type AdminUserRow = {
  user: Omit<User, 'embedding' | 'credentials' | 'password'>;
  role: Pick<Role, 'roleName' | 'roleId'>;
  shops: Shop[];
};

export default function AdminDashboard() {
  const trpc = useTRPC();
  const listUsersQuery = useQuery(trpc.admin.listUsers.queryOptions());
  const users = listUsersQuery.data?.users || [];
  console.log('users in admin dashboard: ', users);
  const isLoading = listUsersQuery.isLoading;
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [activeUser, setActiveUser] = useState<AdminUserRow['user'] | null>(
    null
  );
  const [mode, setMode] = useState<'view' | 'edit'>('view');

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
          onUserUpdated={listUsersQuery.refetch}
        />
      )}
    </div>
  );
}
