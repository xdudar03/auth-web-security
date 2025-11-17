import AccountInfoCard from './AccountInfoCard';
import SettingsCard from './SettingsCard';

export default function Dashboard() {
  return (
    <div className="flex-1 grid w-full gap-3 sm:gap-4 xl:gap-4 xl:overflow-y-scroll-hidden grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[minmax(220px,1fr)] grid-flow-dense items-stretch">
      {/* Account info */}
      <AccountInfoCard />
      {/* Settings */}
      <SettingsCard />
      <div className="col-span-1 bg-surface rounded-lg"></div>

      <div className="xl:col-span-2 bg-surface rounded-lg"></div>
      <div className="col-span-1 bg-surface rounded-lg"></div>
    </div>
  );
}
