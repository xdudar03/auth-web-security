'use client';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Pencil, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';

type UserRow = {
  id: string;
  username: string;
  role: string;
  status: 'active' | 'offline' | 'pending';
  lastActive: string;
};

const placeholderUsers: UserRow[] = [
  {
    id: '1',
    username: 'alice',
    role: 'Admin',
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: '2',
    username: 'bob',
    role: 'Member',
    status: 'offline',
    lastActive: '2h ago',
  },
  {
    id: '3',
    username: 'charlie',
    role: 'Member',
    status: 'pending',
    lastActive: '—',
  },
];

export default function UsersTable() {
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
        accessorKey: 'username',
      },
      {
        header: 'Role',
        accessorKey: 'role',
      },
      {
        header: 'Status',
        accessorKey: 'status',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: Row<UserRow> }) => (
          <div className="flex gap-2">
            <button
              className="icon-btn"
              onClick={() => handleEdit(row.original.id)}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleDelete(row.original.id)}
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
    data: placeholderUsers,
    columns,
    state: {
      rowSelection,
    },
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
  });
  const handleEdit = (id: string) => {
    console.log('editing user', id);
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
