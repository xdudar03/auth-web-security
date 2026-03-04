'use client';

import { Activity, CheckCircle2, UserCheck, Users } from 'lucide-react';
import { RecentSimulationOutcomePanel } from './shop-stats/RecentSimulationOutcomePanel';
import { UsersBehaviorPanel } from './shop-stats/UsersBehaviorPanel';
import { SimulationProgressPanel } from './shop-stats/SimulationProgressPanel';
import { StatCard } from './shop-stats/StatCard';
import { useShopSimulation } from '@/hooks/useShopSimulation';

export default function ShopStats() {
  const {
    shopName,
    progress,
    progressPercent,
    isRunning,
    disableSimulate,
    handleSimulateShopActivity,
    runRegisteredRate,
    allRegisteredRate,
    totalSimulatedVisits,
    registeredUsersCount,
    registeredSlotShare,
    registeredUserFrequency,
    recentRunEvents,
  } = useShopSimulation();

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Shop Stats</h1>
        <p className="text-sm text-muted">
          View stats for your shop <span className="font-bold">{shopName}</span>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-border pt-4">
        <StatCard
          icon={Users}
          label="Registered Users"
          value={registeredUsersCount}
        />
        <StatCard
          icon={UserCheck}
          label="Registered Visit Rate (Run)"
          value={`${runRegisteredRate}%`}
        />
        <StatCard
          icon={Activity}
          label="Registered Visit Rate (Session)"
          value={`${allRegisteredRate}%`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Total Simulated Visits"
          value={totalSimulatedVisits}
        />
      </div>

      <SimulationProgressPanel
        progress={progress}
        progressPercent={progressPercent}
        isRunning={isRunning}
        onSimulate={handleSimulateShopActivity}
        disableSimulate={disableSimulate}
      />

      <UsersBehaviorPanel
        registeredSlotShare={registeredSlotShare}
        registeredUserFrequency={registeredUserFrequency}
      />

      <RecentSimulationOutcomePanel recentRunEvents={recentRunEvents} />
    </div>
  );
}
