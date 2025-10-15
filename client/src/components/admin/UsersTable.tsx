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
import { User, useUser } from '@/hooks/useUserContext';
import { getUserInfo } from '@/lib/admin/getUserInfo';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type UserRow = {
  id: string;
  username: string;
  roleName: string;
};

export default function UsersTable({
  setShowUserInfoModal,
  users,
  activeUser,
  setActiveUser,
  setMode,
}: {
  setShowUserInfoModal: (show: boolean) => void;
  users: UserRow[];
  activeUser: User;
  setActiveUser: (user: User) => void;
  setMode: (mode: 'view' | 'edit') => void;
}) {
  const { role } = useUser();
  console.log('role', role);
  console.log('users', users);

  const handleView = useCallback(
    async (id: string) => {
      console.log('viewing user', id);
      if (role?.canReadUsers) {
        const userInfo = await getUserInfo(id);
        setShowUserInfoModal(true);
        console.log('userInfo', userInfo);
        setActiveUser(userInfo);
        setMode('view');
      }
    },
    [role, setActiveUser, setMode, setShowUserInfoModal]
  );

  const handleEdit = useCallback(
    async (id: string) => {
      console.log('editing user', id);
      if (role?.canChangeUsersCredentials) {
        const userInfo = await getUserInfo(id);
        setShowUserInfoModal(true);
        setActiveUser(userInfo);
        setMode('edit');
      } else if (activeUser && role?.canChangeUsersCredentials) {
        setShowUserInfoModal(true);
        setActiveUser(activeUser);
        setMode('edit');
      } else {
        alert('You do not have permission to edit this user');
      }
    },
    [role, activeUser, setActiveUser, setMode, setShowUserInfoModal]
  );

  const handleDelete = useCallback((id: string) => {
    console.log('deleting user', id);
  }, []);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: Table<UserRow> }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }: { row: Row<UserRow> }) => (
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
        header: 'Role',
        accessorKey: 'role.roleName',
      },

      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: Row<UserRow> }) => (
          <div className="flex gap-2">
            <button
              className="icon-btn"
              onClick={() => handleView(row.original.user.id)}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleEdit(row.original.user.id)}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleDelete(row.original.user.id)}
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        ),
        accessorKey: 'actions',
      },
    ],
    [handleView, handleEdit, handleDelete]
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
  console.log('rowSelection', rowSelection);
  return (
    <div className="lg:col-span-2 col-span-1 bg-surface rounded-lg h-full overflow-hidden">
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
