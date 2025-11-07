import { useMemo, useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ShoppingListMobile from './ShoppingListMobile';
import { formatCurrency, formatDate } from '@/lib/shopping-history/utils';

// Placeholder data until backend wiring
const history: HistoryEntry[] = [
  {
    id: '1',
    date: '2025-10-21T14:32:00Z',
    items: [{ name: 'Wireless Headphones', quantity: 1, unitPrice: 129.99 }],
    shopLocation: 'Downtown Store',
    paymentMethod: 'Card',
    isOnline: false,
  },
  {
    id: '2',
    date: '2025-11-01T09:10:00Z',
    items: [
      { name: 'Coffee Beans (1kg)', quantity: 2, unitPrice: 19.25 },
      { name: 'French Press', quantity: 1, unitPrice: 45.0 },
    ],
    shopLocation: 'Online',
    paymentMethod: 'PayPal',
    isOnline: true,
  },
  {
    id: '3',
    date: '2025-11-05T17:45:00Z',
    items: [
      { name: 'Notebook Pack', quantity: 3, unitPrice: 5.25 },
      { name: 'Gel Pens (4-pack)', quantity: 2, unitPrice: 3.5 },
    ],
    shopLocation: 'Uptown Market',
    paymentMethod: 'Cash',
    isOnline: false,
  },
];

export type AssociationChoice = 'detached' | 'linked' | 'anonymized';

export type HistoryEntry = {
  id: string;
  date: string; // ISO string
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number; // in major units
  }>;
  shopLocation: string;
  paymentMethod: 'Card' | 'Cash' | 'Apple Pay' | 'Google Pay' | 'PayPal';
  isOnline: boolean;
};
export default function ShoppingTable() {
  // Association state per order (default: 'detached')
  const initialAssociationById = useMemo(() => {
    const entries = history.map((e) => [e.id, 'detached' as AssociationChoice]);
    return Object.fromEntries(entries) as Record<string, AssociationChoice>;
  }, []);
  const [associationById, setAssociationById] = useState<
    Record<string, AssociationChoice>
  >(initialAssociationById);
  const [bulkChoice, setBulkChoice] = useState<AssociationChoice>('detached');

  const applyBulkChoice = () => {
    const updated: Record<string, AssociationChoice> = {};
    for (const entry of history) {
      updated[entry.id] = bulkChoice;
    }
    setAssociationById(updated);
  };

  const setRowChoice = (id: string, value: AssociationChoice) => {
    setAssociationById((prev) => ({ ...prev, [id]: value }));
  };
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border bg-surface/60">
        <label htmlFor="bulkAssociation" className="text-sm text-muted">
          Set association for all orders
        </label>
        <select
          id="bulkAssociation"
          className="h-9 px-3 rounded-md border border-border bg-surface text-sm"
          value={bulkChoice}
          onChange={(e) => setBulkChoice(e.target.value as AssociationChoice)}
        >
          <option value="detached">Detached (default)</option>
          <option value="linked">Linked</option>
          <option value="anonymized">Anonymized</option>
        </select>
        <Button size="sm" onClick={applyBulkChoice}>
          Apply to all
        </Button>
      </div>
      {/* Mobile list view */}
      <ShoppingListMobile
        history={history}
        associationById={associationById}
        setRowChoice={setRowChoice}
      />

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[900px] w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Items</TableHead>
              <TableHead className="hidden lg:table-cell">Quantity</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-left hidden lg:table-cell">
                Shop location
              </TableHead>
              <TableHead className="hidden xl:table-cell">
                Payment method
              </TableHead>
              <TableHead className="hidden lg:table-cell">Online</TableHead>
              <TableHead className="text-left whitespace-nowrap">
                Date
              </TableHead>
              <TableHead className="text-left">Association</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-left">
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
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {entry.items.reduce((sum, it) => sum + it.quantity, 0)}
                </TableCell>
                <TableCell>
                  {formatCurrency(
                    entry.items.reduce(
                      (sum, it) => sum + it.quantity * it.unitPrice,
                      0
                    )
                  )}
                </TableCell>
                <TableCell className="text-left hidden lg:table-cell truncate max-w-[200px]">
                  {entry.shopLocation}
                </TableCell>
                <TableCell className="hidden xl:table-cell truncate max-w-[180px]">
                  {entry.paymentMethod}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {entry.isOnline ? (
                    <Badge variant="success">Online</Badge>
                  ) : (
                    <Badge variant="default">In-store</Badge>
                  )}
                </TableCell>
                <TableCell className="text-left whitespace-nowrap">
                  {formatDate(entry.date)}
                </TableCell>
                <TableCell className="text-left">
                  <select
                    className="h-9 px-3 rounded-md border border-border bg-surface text-sm"
                    value={associationById[entry.id]}
                    onChange={(e) =>
                      setRowChoice(
                        entry.id,
                        e.target.value as AssociationChoice
                      )
                    }
                    aria-label={`Association for order ${entry.id}`}
                  >
                    <option value="detached">Detached</option>
                    <option value="linked">Linked</option>
                    <option value="anonymized">Anonymized</option>
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
