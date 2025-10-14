'use client';
import { Activity, Users } from 'lucide-react';
import AccountStatsCard from './AccountStatsCard';
import SettingsCard from '../dashboard/SettingsCard';
import StatCard from './StatCard';
import UsersTable from './UsersTable';
import { useEffect, useState } from 'react';
import { getAllUsers } from '@/lib/admin/getAllUsers';
import { User } from '@/hooks/useUserContext';
import UserInfoModal from './UserInfoModal';

type UserRow = {
  id: string;
  username: string;
  roleName: string;
};

export default function AdminDashboard() {
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  console.log('activeUser', activeUser);
  useEffect(() => {
    getAllUsers().then((users) => setUsers(users));
  }, []);
  return (
    <div className="grid w-full gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
      <SettingsCard />
      <StatCard
        title="Total Users"
        value="—"
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
        mode={mode}
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
