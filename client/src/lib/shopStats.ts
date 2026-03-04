import {
  type DbRegisteredEvent,
  type ProgressState,
  type RegisteredSlotShare,
  type ShopVisitFromDb,
  type SimulationEvent,
  type TimeSlot,
} from '../types/statistics';

export const SLOT_ORDER: TimeSlot[] = [
  'Night',
  'Morning',
  'Afternoon',
  'Evening',
];
export const PANEL_CLASS =
  'rounded-lg border border-border p-4 bg-background/50';

export const createInitialProgress = (): ProgressState => ({
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
});

export const getTimeSlot = (dateISO: string): TimeSlot => {
  const hour = new Date(dateISO).getHours();

  if (hour < 6) {
    return 'Night';
  }
  if (hour < 12) {
    return 'Morning';
  }
  if (hour < 18) {
    return 'Afternoon';
  }
  return 'Evening';
};

export const randomizeArray = <T>(items: T[]) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const createRandomVisitAt = () =>
  new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30).toISOString();

export const calculateRegisteredRate = (events: SimulationEvent[]) => {
  if (events.length === 0) {
    return 0;
  }
  const registeredCount = events.filter((event) => event.isRegistered).length;
  return Math.round((registeredCount / events.length) * 100);
};

export const getProgressPercent = (progress: ProgressState) => {
  if (progress.total === 0) {
    return 0;
  }
  return Math.round((progress.processed / progress.total) * 100);
};

export const buildDbRegisteredEvents = (
  shopVisits: ShopVisitFromDb[]
): DbRegisteredEvent[] =>
  shopVisits
    .filter((visit) => Boolean(visit.userId))
    .map((visit) => ({
      id: visit.userId as string,
      visitAt: visit.visitAt,
    }));

export const buildRegisteredUserFrequency = (
  dbRegisteredEvents: DbRegisteredEvent[]
) => {
  const userMap = new Map<
    string,
    { count: number; slots: Record<TimeSlot, number> }
  >();

  for (const event of dbRegisteredEvents) {
    const slot = getTimeSlot(event.visitAt);
    const existing = userMap.get(event.id);

    if (!existing) {
      userMap.set(event.id, {
        count: 1,
        slots: { Night: 0, Morning: 0, Afternoon: 0, Evening: 0, [slot]: 1 },
      });
      continue;
    }

    existing.count += 1;
    existing.slots[slot] += 1;
  }

  return [...userMap.entries()]
    .map(([id, stats]) => {
      const preferredSlot = SLOT_ORDER.reduce((bestSlot, currentSlot) =>
        stats.slots[currentSlot] > stats.slots[bestSlot]
          ? currentSlot
          : bestSlot
      );

      return {
        id,
        count: stats.count,
        preferredSlot,
        preferredSlotCount: stats.slots[preferredSlot],
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

export const buildRegisteredSlotShare = (
  dbRegisteredEvents: DbRegisteredEvent[]
): RegisteredSlotShare => {
  const slots: Record<TimeSlot, number> = {
    Night: 0,
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
  };

  for (const event of dbRegisteredEvents) {
    slots[getTimeSlot(event.visitAt)] += 1;
  }

  const total = Object.values(slots).reduce((acc, value) => acc + value, 0);
  const dominantSlot = SLOT_ORDER.reduce((best, slot) =>
    slots[slot] > slots[best] ? slot : best
  );

  return {
    slots,
    total,
    dominantSlot,
    dominantRate:
      total > 0 ? Math.round((slots[dominantSlot] / total) * 100) : 0,
  };
};

export const getEventBadgeClass = (isRegistered: boolean) => {
  if (isRegistered) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
};
