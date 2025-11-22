import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import ShoppingListMobile from './ShoppingListMobile';
import { formatPaymentMethod } from '@/lib/shopping-history/utils';
import { useTRPC } from '@/hooks/TrpcContext';
import { PrivacySettings, useUser } from '@/hooks/useUserContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AssociationChoice, HistoryEntry, TransactionsData } from './types';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  associationColumn,
  totalColumn,
  shopLocationColumn,
  paymentMethodColumn,
  onlineColumn,
  dateColumn,
  quantityColumn,
  itemsColumn,
} from '@/lib/historyColumns';

export default function ShoppingTable({
  setSpendings,
}: {
  setSpendings: (spendings: { total: number; currency: string }) => void;
}) {
  // Association state per order (default: 'detached')
  const [associationById, setAssociationById] = useState<
    Record<string, AssociationChoice>
  >({});
  const [bulkChoice, setBulkChoice] = useState<AssociationChoice>('hidden');
  const { user, privacy } = useUser();
  const trpc = useTRPC();
  const transactionsQuery = useQuery(
    trpc.transactions.getTransactionsById.queryOptions({
      userId: user?.userId as string,
    })
  );
  const queryClient = useQueryClient();
  const toggleUserPrivacyMutation = useMutation(
    trpc.privacy.toggleUserPrivacyService.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
      },
    })
  );
  const transactions = transactionsQuery.data as TransactionsData;

  useEffect(() => {
    if (!transactions) return;
    const total = transactions.reduce(
      (acc, t) =>
        acc + t.items.reduce((acc, i) => acc + i.price * i.quantity, 0),
      0
    );
    setSpendings({ total, currency: 'USD' });
  }, [transactions, setSpendings]);

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

  type ColumnMeta = {
    headerClassName?: string;
    cellClassName?: string;
  };

  const handleAssociationChange = useCallback(
    async (id: string, value: AssociationChoice) => {
      setAssociationById((prev) => ({ ...prev, [id]: value }));
      await toggleUserPrivacyMutation.mutateAsync({
        field: `shoppingHistory_transaction_${id}`,
        visibility: value,
      });
    },
    [toggleUserPrivacyMutation]
  );

  const columns = useMemo<ColumnDef<HistoryEntry, unknown>[]>(
    () => [
      itemsColumn(),
      quantityColumn(),
      totalColumn(),
      shopLocationColumn(),
      paymentMethodColumn(),
      onlineColumn(),
      dateColumn(),
      associationColumn(
        privacy ?? ([] as PrivacySettings[]),
        handleAssociationChange
      ),
    ],
    [privacy, handleAssociationChange]
  );

  const table = useReactTable({
    data: historyEntries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    if (historyEntries.length === 0) return;
    setAssociationById((prev) => {
      const next = { ...prev } as Record<string, AssociationChoice>;
      for (const entry of historyEntries) {
        if (!next[entry.id]) next[entry.id] = 'hidden';
      }
      return next;
    });
  }, [historyEntries]);

  const applyBulkChoice = async () => {
    const updated: Record<string, AssociationChoice> = {};
    for (const entry of historyEntries) {
      updated[entry.id] = bulkChoice;
    }
    setAssociationById(updated);
    for (const entry of historyEntries) {
      await toggleUserPrivacyMutation.mutateAsync({
        field: `shoppingHistory_transaction_${entry.id}`,
        visibility: bulkChoice,
      });
    }
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border bg-surface/60">
        <label htmlFor="bulkAssociation" className="text-sm text-muted">
          Set association for all orders
        </label>
        <div className="flex items-center gap-2 flex-col sm:flex-row ">
          <select
            id="bulkAssociation"
            className="h-9 px-3 rounded-md border border-border bg-surface text-sm"
            value={bulkChoice}
            onChange={(e) => setBulkChoice(e.target.value as AssociationChoice)}
          >
            <option value="hidden">Detached (default)</option>
            <option value="visible">Linked</option>
            <option value="anonymized">Anonymized</option>
          </select>
          <Button size="sm" onClick={applyBulkChoice}>
            Apply to all
          </Button>
        </div>
      </div>
      {/* Mobile list view */}
      <ShoppingListMobile
        history={historyEntries}
        associationById={associationById}
        handleAssociationChange={handleAssociationChange}
      />

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[900px] w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = (
                    header.column.columnDef as {
                      meta?: ColumnMeta;
                    }
                  ).meta;
                  return (
                    <TableHead
                      key={header.id}
                      className={meta?.headerClassName ?? undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = (
                      cell.column.columnDef as {
                        meta?: ColumnMeta;
                      }
                    ).meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={meta?.cellClassName ?? undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="text-center"
                >
                  No transactions found for user {user?.username}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
