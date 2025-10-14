'use client';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Eye, Pencil, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { User, useUser } from '@/hooks/useUserContext';
import { getUserInfo } from '@/lib/admin/getUserInfo';

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
  mode,
  setMode,
}: {
  setShowUserInfoModal: (show: boolean) => void;
  users: UserRow[];
  activeUser: User;
  setActiveUser: (user: User) => void;
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;
}) {
  const { role } = useUser();
  console.log('role', role);
  console.log('users', users);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: Table<UserRow> }) => (
          <input
            type="checkbox"
            className="input"
            onChange={(e) => table.toggleAllRowsSelected(e.target.checked)}
            checked={table.getIsAllRowsSelected()}
          />
        ),
        cell: ({ row }: { row: Row<UserRow> }) => (
          <input
            type="checkbox"
            className="input"
            onChange={(e) => row.toggleSelected()}
            checked={row.getIsSelected()}
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
    []
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
  const handleView = async (id: string) => {
    console.log('viewing user', id);
    if (role?.canReadUsers) {
      const userInfo = await getUserInfo(id);
      setShowUserInfoModal(true);
      console.log('userInfo', userInfo);
      setActiveUser(userInfo);
      setMode('view');
    }
  };
  const handleEdit = async (id: string) => {
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
  };
  const handleDelete = (id: string) => {
    console.log('deleting user', id);
  };
  console.log('rowSelection', rowSelection);
  return (
    <div className="lg:col-span-2 col-span-1 bg-surface rounded-lg h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 box-border">
        <div className="p-2 flex-1 min-h-0 box-border">
          <h3 className="text-lg font-semibold text-center">User List</h3>
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-sm text-gray-200">
              <thead className="bg-gray-800">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-2 text-left">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-700">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
