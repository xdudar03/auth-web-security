'use client';
import { User } from '@/hooks/useUserContext';
import { Activity, Users } from 'lucide-react';
import { useState } from 'react';
import AccountStatsCard from '../admin/AccountStatsCard';
import StatCard from '../admin/StatCard';
import UserInfoModal from '../admin/UserInfoModal';
import SettingsCard from '../dashboard/SettingsCard';
import UsersTable from '../UsersTable';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUserContext';

export default function ProviderDashboard() {
  const trpc = useTRPC();
  const { shops } = useUser();
  console.log('shops: ', shops);
  const shopId = shops?.[0]?.shopId;
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const allUsersQuery = useQuery(
    trpc.shops.getAllUsersFromShop.queryOptions({ shopId: shopId ?? 0 })
  );
  const users = allUsersQuery.data?.users ?? [];
  const isLoading = allUsersQuery.isLoading;
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
        setMode={() => {}}
      />
      {showUserInfoModal && activeUser && (
        <UserInfoModal
          activeUser={activeUser as User}
          setShowUserInfoModal={setShowUserInfoModal}
          setActiveUser={setActiveUser}
          mode={'view'}
          setMode={() => {}}
          onUserUpdated={allUsersQuery.refetch}
        />
      )}
    </div>
  );
}
