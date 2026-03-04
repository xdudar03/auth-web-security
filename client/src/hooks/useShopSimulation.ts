import { useTRPC } from '@/hooks/TrpcContext';
import { useUser } from '@/hooks/useUserContext';
import {
  buildDbRegisteredEvents,
  buildRegisteredSlotShare,
  buildRegisteredUserFrequency,
  calculateRegisteredRate,
  createInitialProgress,
  createRandomVisitAt,
  getProgressPercent,
  randomizeArray,
} from '@/lib/shopStats';
import {
  type ProgressState,
  type ShopVisitFromDb,
  type SimulationEvent,
} from '@/types/statistics';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

export function useShopSimulation() {
  const { shops } = useUser();
  const trpc = useTRPC();
  const shopName = shops?.[0]?.shopName;
  const shopId = shops?.[0]?.shopId;
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(createInitialProgress());
  const [runEvents, setRunEvents] = useState<SimulationEvent[]>([]);
  const [allEvents, setAllEvents] = useState<SimulationEvent[]>([]);

  const allUsersQuery = useQuery(
    trpc.shops.getAllUsersFromShop.queryOptions({
      shopId: shopId ?? 0,
    })
  );
  const shopVisitsQuery = useQuery(
    trpc.shops.getShopVisits.queryOptions({
      shopId: shopId ?? 0,
    })
  );

  const users = useMemo(() => allUsersQuery.data?.users ?? [], [allUsersQuery.data]);
  const biometricUsers = useMemo(
    () => users.filter((user) => user.user.isBiometric),
    [users]
  );
  const shopVisits = useMemo(
    () => (shopVisitsQuery.data?.visits ?? []) as ShopVisitFromDb[],
    [shopVisitsQuery.data]
  );

  const addShopVisitMutation = useMutation(
    trpc.providers.addNewShopVisit.mutationOptions()
  );
  const predictFromEmbeddingMutation = useMutation(
    trpc.model.predict.mutationOptions()
  );

  const registeredUsers = useMemo(
    () =>
      new Set(
        users
          .filter((user) => user.user.registered)
          .map((user) => user.user.userId)
      ),
    [users]
  );

  const handleSimulateShopActivity = async () => {
    if (!shopId) {
      return;
    }

    const sampleSize = Math.max(1, Math.floor(biometricUsers.length / 2));
    const selectedUsers = randomizeArray(biometricUsers).slice(0, sampleSize);

    if (selectedUsers.length === 0) {
      setProgress(createInitialProgress());
      setRunEvents([]);
      return;
    }

    setIsRunning(true);
    setRunEvents([]);
    setProgress({
      total: selectedUsers.length,
      processed: 0,
      successful: 0,
      failed: 0,
    });

    let successful = 0;
    let failed = 0;

    for (const selectedUser of selectedUsers) {
      try {
        const prediction = await predictFromEmbeddingMutation.mutateAsync({
          id: selectedUser.user.userId,
        });
        const predictedLabel = prediction.predictedLabel;
        const visitAt = createRandomVisitAt();
        await addShopVisitMutation.mutateAsync({
          id: predictedLabel,
          shopId: shopId ?? 0,
          visitAt,
        });

        const event = {
          id: predictedLabel,
          isRegistered: registeredUsers.has(predictedLabel),
          visitAt,
        };

        successful += 1;
        setRunEvents((prev) => [event, ...prev]);
        setAllEvents((prev) => [event, ...prev]);
      } catch {
        failed += 1;
      } finally {
        setProgress((prev) => ({
          ...prev,
          processed: prev.processed + 1,
          successful,
          failed,
        }));
      }
    }

    setIsRunning(false);
    await shopVisitsQuery.refetch();
  };

  const runRegisteredRate = useMemo(() => calculateRegisteredRate(runEvents), [runEvents]);
  const allRegisteredRate = useMemo(() => calculateRegisteredRate(allEvents), [allEvents]);
  const progressPercent = useMemo(() => getProgressPercent(progress), [progress]);
  const recentRunEvents = useMemo(() => runEvents.slice(0, 12), [runEvents]);

  const dbRegisteredEvents = useMemo(
    () => buildDbRegisteredEvents(shopVisits),
    [shopVisits]
  );
  const registeredUserFrequency = useMemo(
    () => buildRegisteredUserFrequency(dbRegisteredEvents),
    [dbRegisteredEvents]
  );
  const registeredSlotShare = useMemo(
    () => buildRegisteredSlotShare(dbRegisteredEvents),
    [dbRegisteredEvents]
  );

  const disableSimulate =
    isRunning || allUsersQuery.isLoading || biometricUsers.length === 0;

  return {
    shopName,
    progress,
    progressPercent,
    isRunning,
    disableSimulate,
    handleSimulateShopActivity,
    runRegisteredRate,
    allRegisteredRate,
    totalSimulatedVisits: allEvents.length,
    registeredUsersCount: registeredUsers.size,
    registeredSlotShare,
    registeredUserFrequency,
    recentRunEvents,
  };
}
