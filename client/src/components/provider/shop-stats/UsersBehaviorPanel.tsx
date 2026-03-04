import { PANEL_CLASS } from '@/lib/shopStats';
import { RegisteredSlotShare, RegisteredVisitor } from '@/types/statistics';

export type UsersBehaviorPanelProps = {
  registeredSlotShare: RegisteredSlotShare;
  registeredUserFrequency: RegisteredVisitor[];
};

export function UsersBehaviorPanel({
  registeredSlotShare,
  registeredUserFrequency,
}: UsersBehaviorPanelProps) {
  return (
    <div className={PANEL_CLASS}>
      <p className="text-sm font-medium mb-1">Registered Visitor Behavior</p>
      <p className="text-xs text-muted mb-3">
        Based on DB shop visits: peak time for registered users is{' '}
        {registeredSlotShare.dominantSlot} ({registeredSlotShare.dominantRate}%
        of registered visits)
      </p>

      {registeredUserFrequency.length === 0 ? (
        <p className="text-sm text-muted">
          No registered visits in the database yet for this shop.
        </p>
      ) : (
        <div className="space-y-2">
          {registeredUserFrequency.map((visitor) => (
            <div
              key={visitor.id}
              className="rounded-md border border-border px-3 py-2 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm">
                  Registered user:{' '}
                  <span className="font-mono">{visitor.id}</span>
                </p>
                <p className="text-xs text-muted">
                  Most frequent in {visitor.preferredSlot} (
                  {visitor.preferredSlotCount} visits)
                </p>
              </div>
              <span className="text-sm font-semibold">
                {visitor.count} total visits
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
