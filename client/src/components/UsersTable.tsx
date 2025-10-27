'use client';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Eye, Pencil, Trash } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { Role, Shop, User, useUser } from '@/hooks/useUserContext';
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

export type AdminUserRow = {
  user: User;
  role: Role;
  shops: Shop[];
};

export default function UsersTable({
  setShowUserInfoModal,
  users,
  setActiveUser,
  setMode,
}: {
  setShowUserInfoModal: (show: boolean) => void;
  users: AdminUserRow[];
  setActiveUser: (user: User) => void;
  setMode: (mode: 'view' | 'edit') => void;
}) {
  const { role } = useUser();
  // const [userId, setUserId] = useState<string>('');

  const handleView = useCallback(
    (user: User) => {
      // todo super hack
      // id = id.toString();
      // console.log('id', id);
      console.log('user in handleView: ', user);
      if (!role?.canReadUsers) {
        return;
      }
      // setUserId(user.id);
      setActiveUser(user);
      setShowUserInfoModal(true);
      setMode('view');
    },
    [role?.canReadUsers, setActiveUser, setMode, setShowUserInfoModal]
  );

  const handleEdit = useCallback(
    async (user: User) => {
      if (role?.canChangeUsersCredentials) {
        // setUserId(id);
        // const userInfo = getUserQuery.data?.user;

        setShowUserInfoModal(true);
        setActiveUser(user);
        setMode('edit');
      } else {
        alert('You do not have permission to edit this user');
      }
    },
    [
      role?.canChangeUsersCredentials,
      setActiveUser,
      setMode,
      setShowUserInfoModal,
    ]
  );

  const handleDelete = useCallback((user: User) => {
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
            {role?.canChangeUsersCredentials ? (
              <Button
                variant="ghost"
                onClick={() => handleEdit(row.original.user)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            ) : null}
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
    [handleView, handleEdit, handleDelete, role?.canChangeUsersCredentials]
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
  // console.log('rowSelection', rowSelection);
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
