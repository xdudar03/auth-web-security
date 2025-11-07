import { AssociationChoice, HistoryEntry } from './ShoppingTable';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/shopping-history/utils';

export default function ShoppingListMobile({
  history,
  associationById,
  setRowChoice,
}: {
  history: HistoryEntry[];
  associationById: Record<string, AssociationChoice>;
  setRowChoice: (id: string, value: AssociationChoice) => void;
}) {
  return (
    <div className="md:hidden">
      <div className="flex flex-col divide-y divide-border">
        {history.map((entry) => (
          <div key={entry.id} className="p-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-col gap-1">
                  {entry.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{it.name}</span>
                      <span className="text-muted">× {it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm text-muted">Total</div>
                <div className="font-semibold">
                  {formatCurrency(
                    entry.items.reduce(
                      (sum, it) => sum + it.quantity * it.unitPrice,
                      0
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {entry.isOnline ? (
                  <Badge variant="success">Online</Badge>
                ) : (
                  <Badge variant="default">In-store</Badge>
                )}
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDate(entry.date)}
                </span>
              </div>
              <div className="text-right text-xs text-muted truncate">
                {entry.shopLocation} · {entry.paymentMethod}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label
                className="text-sm text-muted"
                htmlFor={`assoc-${entry.id}`}
              >
                Association
              </label>
              <select
                id={`assoc-${entry.id}`}
                className="h-9 px-3 rounded-md border border-border bg-surface text-sm w-full"
                value={associationById[entry.id]}
                onChange={(e) =>
                  setRowChoice(entry.id, e.target.value as AssociationChoice)
                }
              >
                <option value="detached">Detached</option>
                <option value="linked">Linked</option>
                <option value="anonymized">Anonymized</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
