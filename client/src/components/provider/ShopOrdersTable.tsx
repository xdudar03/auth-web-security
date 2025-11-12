import { useMemo } from 'react';
import {
  Table,
  TableCell,
  TableRow,
  TableBody,
  TableHead,
  TableHeader,
} from '../ui/table';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/TrpcContext';
import { formatPaymentMethod } from '@/lib/shopping-history/utils';
import { BackendTransaction, HistoryEntry } from '../shopping-history/types';
import {
  itemsColumn,
  quantityColumn,
  totalColumn,
  shopLocationColumn,
  paymentMethodColumn,
  onlineColumn,
  dateColumn,
  customerColumn,
} from '@/lib/historyColumns';
import { HistoryEntryWithCustomer } from '@/lib/historyColumns';
import useUserPrivacy from '@/hooks/useUserPrivacy';

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

export type HistoryEntryProvider = HistoryEntry & {
  customer: string;
};

export default function ShopOrdersTable({ shopId }: { shopId: number }) {
  const trpc = useTRPC();
  const transactionsQuery = useQuery(
    trpc.transactions.getTransactionsByShopId.queryOptions({
      shopId: shopId as number,
    })
  );
  const transactions = transactionsQuery.data;
  const transactionsReady = transactionsQuery.isSuccess;
  const userFields: { pseudoId: string; field: string }[] = transactionsReady
    ? transactions?.map((t: BackendTransaction) => ({
        pseudoId: t.pseudoId ?? '',
        field: `shoppingHistory_transaction_${t.transactionId}`,
      })) ?? []
    : [];

  const { userPrivacy } = useUserPrivacy(userFields);
  console.log('userPrivacy: ', userPrivacy);
  const historyEntries: HistoryEntryProvider[] = useMemo(() => {
    if (!transactions) return [];
    return transactions.map((t: BackendTransaction) => ({
      id: String(t.transactionId),
      customer: t.pseudoId ?? '',
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

  const columns = useMemo<ColumnDef<HistoryEntryWithCustomer, unknown>[]>(
    () => [
      itemsColumn(),
      quantityColumn(),
      totalColumn(),
      shopLocationColumn(),
      paymentMethodColumn(),
      onlineColumn(),
      dateColumn(),
      customerColumn({ userPrivacy: userPrivacy ?? [] }) as ColumnDef<
        HistoryEntryWithCustomer,
        unknown
      >,
    ],
    [userPrivacy]
  );
  const table = useReactTable({
    data: historyEntries,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <Table>
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
          {table.getRowModel().rows.map((row) => (
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
