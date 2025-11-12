'use client';
import { useUser } from '@/hooks/useUserContext';
import { useMemo } from 'react';
export default function ShopHistory() {
  const { shops } = useUser();
  const shopName = shops?.[0]?.shopName;
  const columns = useMemo(
    () => [
      {
        header: 'Items',
        accessorKey: 'items',
      },
      {
        header: 'Quantity',
        accessorKey: 'quantity',
      },
      {
        header: 'Total',
        accessorKey: 'total',
      },
      {
        header: 'Shop location',
        accessorKey: 'shopLocation',
      },
      {
        header: 'Payment method',
        accessorKey: 'paymentMethod',
      },
      {
        header: 'Online',
        accessorKey: 'isOnline',
      },
      {
        header: 'Date',
        accessorKey: 'date',
      },
      {
        header: 'Customer',
        accessorKey: 'customer',
      },
    ],
    []
  );
  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Shop History</h1>
        <p className="text-sm text-muted">
          View order history for your shop{' '}
          <span className="font-bold">{shopName}</span>.
        </p>
      </div>
    </div>
  );
}
