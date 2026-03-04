import { PANEL_CLASS, getEventBadgeClass, getTimeSlot } from '@/lib/shopStats';
import { SimulationEvent } from '@/types/statistics';

export type RecentSimulationOutcomePanelProps = {
  recentRunEvents: SimulationEvent[];
};

export function RecentSimulationOutcomePanel({
  recentRunEvents,
}: RecentSimulationOutcomePanelProps) {
  return (
    <div className={PANEL_CLASS}>
      <p className="text-sm font-medium mb-3">Recent Simulation Outcomes</p>

      {recentRunEvents.length === 0 ? (
        <p className="text-sm text-muted">
          Start a simulation to see how often registered users are predicted to
          visit this shop.
        </p>
      ) : (
        <div className="space-y-2">
          {recentRunEvents.map((event, idx) => (
            <div
              key={`${event.id}-${idx}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm">
                  Visitor ID: <span className="font-mono">{event.id}</span>
                </p>
                <p className="text-xs text-muted">
                  {new Date(event.visitAt).toLocaleString()} (
                  {getTimeSlot(event.visitAt)})
                </p>
              </div>

              <span
                className={`text-xs px-2 py-1 rounded-full ${getEventBadgeClass(event.isRegistered)}`}
              >
                {event.isRegistered ? 'Registered user' : 'Unknown customer'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
