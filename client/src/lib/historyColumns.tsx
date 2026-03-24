import { AssociationChoice, HistoryEntry } from '@/types/shoppingHistory';
import { Badge } from '@/components/ui/badge';
import { PrivacySettings } from '@/hooks/useUserContext';
import { formatCurrency, formatDate } from '@/lib/shopping-history/format';
import { CellContext, ColumnDef } from '@tanstack/react-table';
import { HistoryEntryProvider } from '@/components/provider/ShopOrdersTable';

export type HistoryEntryWithCustomer = HistoryEntry | HistoryEntryProvider;

export const itemsColumn = (): ColumnDef<HistoryEntryWithCustomer, unknown> => {
  return {
    id: 'items',
    header: 'Items',
    meta: { headerClassName: 'text-left' },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return (
        <div className="flex flex-col gap-1">
          {row.original.items.map(
            (it: { name: string; quantity: number }, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="font-medium">{it.name}</span>
                <span className="text-muted">× {it.quantity}</span>
              </div>
            )
          )}
        </div>
      );
    },
  };
};

export const quantityColumn = (): ColumnDef<
  HistoryEntryWithCustomer,
  unknown
> => {
  return {
    id: 'quantity',
    header: 'Quantity',
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
    },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return row.original.items.reduce((sum, it) => sum + it.quantity, 0);
    },
  };
};

export const totalColumn = (): ColumnDef<HistoryEntryWithCustomer, unknown> => {
  return {
    id: 'total',
    header: 'Total',
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return formatCurrency(
        row.original.items.reduce(
          (sum, it) => sum + it.quantity * it.unitPrice,
          0
        )
      );
    },
  };
};

export const shopLocationColumn = (): ColumnDef<
  HistoryEntryWithCustomer,
  unknown
> => {
  return {
    id: 'shopLocation',
    header: 'Shop location',
    meta: {
      headerClassName: 'text-left hidden lg:table-cell',
      cellClassName: 'text-left hidden lg:table-cell truncate max-w-[200px]',
    },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return row.original.shopLocation;
    },
  };
};

export const paymentMethodColumn = (): ColumnDef<
  HistoryEntryWithCustomer,
  unknown
> => {
  return {
    id: 'paymentMethod',
    header: 'Payment method',
    meta: {
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell truncate max-w-[180px]',
    },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return row.original.paymentMethod;
    },
  };
};

export const onlineColumn = (): ColumnDef<
  HistoryEntryWithCustomer,
  unknown
> => {
  return {
    id: 'online',
    header: 'Online',
    meta: {
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
    },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return row.original.isOnline ? (
        <Badge variant="success">Online</Badge>
      ) : (
        <Badge variant="default">In-store</Badge>
      );
    },
  };
};

export const dateColumn = (): ColumnDef<HistoryEntryWithCustomer, unknown> => {
  return {
    id: 'date',
    header: 'Date',
    meta: { headerClassName: 'text-left whitespace-nowrap' },
    cell: ({ row }: CellContext<HistoryEntryWithCustomer, unknown>) => {
      return formatDate(row.original.date);
    },
  };
};

export const associationColumn = (
  privacy: PrivacySettings[],
  handleAssociationChange: (id: string, value: AssociationChoice) => void
): ColumnDef<HistoryEntry, unknown> => {
  return {
    id: 'association',
    header: 'Association',
    meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
    cell: ({ row }: CellContext<HistoryEntry, unknown>) => {
      const entry = row.original;
      const currentVisibility =
        privacy?.find(
          (p: PrivacySettings) =>
            p.field === `shoppingHistory_transaction_${entry.id}`
        )?.visibility ?? 'hidden';
      return (
        <select
          className="h-9 px-3 rounded-md border border-border bg-surface text-sm"
          value={currentVisibility}
          onChange={(e) =>
            handleAssociationChange(
              entry.id,
              e.target.value as AssociationChoice
            )
          }
          aria-label={`Association for order ${entry.id}`}
        >
          <option value="hidden">Detached</option>
          <option value="visible">Linked</option>
          <option value="anonymized">Anonymized</option>
        </select>
      );
    },
  };
};

export const customerColumn = ({
  userPrivacy,
}: {
  userPrivacy: {
    pseudoId: string;
    visibility: string;
    field: string;
    userId: string;
  }[];
}): ColumnDef<HistoryEntryProvider, unknown> => {
  return {
    id: 'customer',
    header: 'Customer',
    meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
    cell: ({ row }: CellContext<HistoryEntryProvider, unknown>) => {
      const privacySetting = userPrivacy.find(
        (p: {
          pseudoId: string;
          visibility: string;
          field: string;
          userId: string;
        }) => p.field === `shoppingHistory_transaction_${row.original.id}`
      );

      const visibility = privacySetting?.visibility ?? 'hidden';

      switch (visibility) {
        // Linked (visible) -> show userId from privacy settings
        case 'visible':
          return privacySetting?.userId || 'N/A';
        // Anonymized -> show pseudonym
        case 'anonymized':
          return row.original.customer || 'N/A';
        // Hidden -> show nothing
        case 'hidden':
        default:
          return 'Hidden';
      }
    },
  };
};
