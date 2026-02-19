'use client';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Eye, Trash } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from './ui/button';
import type { AdminUserRow } from './admin/AdminDashboard';

export default function UsersTable({
  setShowUserInfoModal,
  users,
  setActiveUser,
}: {
  setShowUserInfoModal: (show: boolean) => void;
  users: AdminUserRow[];
  setActiveUser: (user: AdminUserRow['user']) => void;
}) {
  const handleView = useCallback(
    (user: AdminUserRow['user']) => {
      setActiveUser(user);
      setShowUserInfoModal(true);
    },
    [setActiveUser, setShowUserInfoModal]
  );

  const handleDelete = useCallback((user: AdminUserRow['user']) => {
    console.log('deleting user', user);
  }, []);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: Table<AdminUserRow> }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }: { row: Row<AdminUserRow> }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={() => row.toggleSelected()}
            aria-label={`Select row ${row.id}`}
          />
        ),
        accessorKey: 'select',
        enableSorting: false,
        enableHiding: false,
      },
      {
        header: 'User',
        accessorKey: 'user.username',
      },
      {
        header: 'Shops',
        cell: ({ row }: { row: Row<AdminUserRow> }) => {
          return (
            <div className="flex gap-2">
              {row.original.shops.map((shop) => (
                <span key={shop.shopId}>{shop.shopName}</span>
              ))}
            </div>
          );
        },
      },
      {
        header: 'Role',
        accessorKey: 'role.roleName',
      },
      {
        header: 'Registered',
        cell: ({ row }: { row: Row<AdminUserRow> }) => {
          const registered = row.original.user.registered;
          const isRegistered = registered ? true : false;
          return isRegistered ? 'Yes' : 'No';
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: Row<AdminUserRow> }) => (
          <div className="flex gap-2 justify-center">
            <Button
              variant="ghost"
              onClick={() => handleView(row.original.user)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              className="icon-btn"
              variant="ghost"
              onClick={() => handleDelete(row.original.user)}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        ),
        accessorKey: 'actions',
      },
    ],
    [handleView, handleDelete]
  );
  const [rowSelection, setRowSelection] = useState({});
  const table = useReactTable({
    data: users,
    columns,
    state: {
      rowSelection,
    },
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
  });
  return (
    <div className="lg:col-span-2 col-span-1 bg-surface rounded-lg h-full overflow-y-auto">
      <div className="flex flex-col h-full min-h-0 box-border">
        <div className="p-2 flex-1 min-h-0 box-border">
          <h3 className="text-lg font-semibold text-center">User List</h3>
          <div className="overflow-x-auto mt-4">
            <UITable>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </UITable>
          </div>
        </div>
      </div>
    </div>
  );
}
