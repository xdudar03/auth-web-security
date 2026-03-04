export type SimulationEvent = {
  id: string;
  isRegistered: boolean;
  visitAt: string;
};

export type ShopVisitFromDb = {
  statisticId: number;
  userId: string | null;
  customerId: string | null;
  shopId: number;
  visitAt: string;
};

export type TimeSlot = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

export type ProgressState = {
  total: number;
  processed: number;
  successful: number;
  failed: number;
};

export type RegisteredVisitor = {
  id: string;
  count: number;
  preferredSlot: TimeSlot;
  preferredSlotCount: number;
};

export type RegisteredSlotShare = {
  slots: Record<TimeSlot, number>;
  total: number;
  dominantSlot: TimeSlot;
  dominantRate: number;
};

export type DbRegisteredEvent = {
  id: string;
  visitAt: string;
};
