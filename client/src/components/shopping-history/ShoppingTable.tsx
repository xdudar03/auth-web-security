import { useEffect, useMemo, useState } from 'react';
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
import {
  formatCurrency,
  formatDate,
  formatPaymentMethod,
} from '@/lib/shopping-history/utils';
import { useTRPC } from '@/hooks/TrpcContext';
import { useUser } from '@/hooks/useUserContext';
import { useQuery } from '@tanstack/react-query';
import { AssociationChoice, HistoryEntry, TransactionsData } from './types';

export default function ShoppingTable() {
  // Association state per order (default: 'detached')
  const [associationById, setAssociationById] = useState<
    Record<string, AssociationChoice>
  >({});
  const [bulkChoice, setBulkChoice] = useState<AssociationChoice>('detached');
  const { user } = useUser();
  const trpc = useTRPC();
  console.log('user: ', user);
  const transactionsQuery = useQuery(
    trpc.transactions.getTransactionsById.queryOptions({
      userId: user?.userId as string,
    })
  );
  const transactions = transactionsQuery.data as TransactionsData;
  console.log('transactions: ', transactions);

  const historyEntries: HistoryEntry[] = useMemo(() => {
    if (!transactions) return [];
    return transactions.map((t) => ({
      id: String(t.transactionId),
      date: t.date ?? new Date().toISOString(),
      items: t.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
      })),
      shopLocation: t.location ?? '',
      paymentMethod: formatPaymentMethod(t.paymentMethod ?? ''),
      isOnline: t.purchaseType === 'online',
    }));
  }, [transactions]);

  useEffect(() => {
    if (historyEntries.length === 0) return;
    setAssociationById((prev) => {
      const next = { ...prev } as Record<string, AssociationChoice>;
      for (const entry of historyEntries) {
        if (!next[entry.id]) next[entry.id] = 'detached';
      }
      return next;
    });
  }, [historyEntries]);

  const applyBulkChoice = () => {
    const updated: Record<string, AssociationChoice> = {};
    for (const entry of historyEntries) {
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
        history={historyEntries}
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
            {historyEntries.map((entry) => (
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
