import AccountInfoCard from './AccountInfoCard';
import SettingsCard from './SettingsCard';

export default function Dashboard() {
  return (
    <div className="grid w-full gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
      {/* Account info */}
      <AccountInfoCard />
      {/* Settings */}
      <SettingsCard />
      <div className="col-span-1 bg-surface rounded-lg"></div>

      <div className="lg:col-span-2 bg-surface rounded-lg"></div>
      <div className="col-span-1 bg-surface rounded-lg"></div>
    </div>
  );
}
