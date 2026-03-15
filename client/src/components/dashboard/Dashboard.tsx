'use client';

import AccountInfoCard from './AccountInfoCard';
import DiscountCard from './DiscountCard';
import PLCard from './PLCard';
import SettingsCard from './SettingsCard';
import TopShopCard from './TopShopCard';
import VisibilityCard from './VisibilityCard';
import { useDashboardPrivacyInsights } from '../../lib/privacyInsights';

export default function Dashboard() {
  const { privacyPreset, sortedSettings, visibilityStats, topShopName } =
    useDashboardPrivacyInsights();

  return (
    <div className="flex-1 grid w-full gap-3 sm:gap-4 xl:gap-4 xl:overflow-y-scroll-hidden grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[minmax(220px,1fr)] grid-flow-dense items-stretch">
      {/* Account info */}
      <AccountInfoCard />
      {/* Settings */}
      <SettingsCard />
      <PLCard privacyPreset={privacyPreset} visibilityStats={visibilityStats} />
      <DiscountCard visibilityStats={visibilityStats} />
      {/* <TopShopCard topShopName={topShopName} /> */}
      <VisibilityCard sortedSettings={sortedSettings} />
    </div>
  );
}
