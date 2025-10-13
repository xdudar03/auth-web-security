import { Activity, Users } from 'lucide-react';
import AccountStatsCard from './AccountStatsCard';
import SettingsCard from '../dashboard/SettingsCard';
import StatCard from './StatCard';
import UsersTable from './UsersTable';

export default function AdminDashboard() {
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
      <UsersTable />
    </div>
  );
}
