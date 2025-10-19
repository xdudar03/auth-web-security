'use client';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  Table,
  Row,
} from '@tanstack/react-table';
import { Eye, Pencil, Trash } from 'lucide-react';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Role, User, useUser } from '@/hooks/useUserContext';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '../ui/button';

export type AdminUserRow = {
  user: User;
  role: Role;
};

export default function UsersTable({
  setShowUserInfoModal,
  users,
  activeUser,
  setActiveUser,
  setMode,
}: {
  setShowUserInfoModal: (show: boolean) => void;
  users: AdminUserRow[];
  activeUser: User;
  setActiveUser: (user: User) => void;
  setMode: (mode: 'view' | 'edit') => void;
}) {
  const { role } = useUser();
  const [userId, setUserId] = useState<string>('');
  const trpc = useTRPC();
  const getUserQuery = useQuery({
    ...trpc.admin.getUser.queryOptions({ id: userId }),
    enabled: !!userId, // only auto-fetch if userId exists
  });

  useEffect(() => {
    if (userId && getUserQuery.data?.user) {
      setActiveUser(getUserQuery.data.user as User);
    }
  }, [userId, getUserQuery, setActiveUser, setMode, setShowUserInfoModal]);

  console.log('getUserQuery', getUserQuery);
  const handleView = useCallback(
    async (id: string | number) => {
      // todo super hack
      id = id.toString();
      console.log('id', id);
      setUserId(id);
      if (!role?.canReadUsers) {
        return;
      }
      setShowUserInfoModal(true);
      setMode('view');
      // Refetch user by updating userId, then wait for data to update via query
      // const userInfo = await getUserQuery.refetch();
    },
    [role?.canReadUsers, setMode, setShowUserInfoModal]
  );

  const handleEdit = useCallback(
    async (id: string) => {
      if (role?.canChangeUsersCredentials) {
        setUserId(id);
        const userInfo = getUserQuery.data?.user;
        if (userInfo) {
          setShowUserInfoModal(true);
          setActiveUser(userInfo);
          setMode('edit');
        }
      } else if (activeUser && role?.canChangeUsersCredentials) {
        setShowUserInfoModal(true);
        setActiveUser(activeUser);
        setMode('edit');
      } else {
        alert('You do not have permission to edit this user');
      }
    },
    [
      activeUser,
      getUserQuery.data?.user,
      role?.canChangeUsersCredentials,
      setActiveUser,
      setMode,
      setShowUserInfoModal,
    ]
  );

  const handleDelete = useCallback((id: string) => {
    console.log('deleting user', id);
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
              onClick={() => handleView(row.original.user.id)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleEdit(row.original.user.id)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              className="icon-btn"
              variant="ghost"
              onClick={() => handleDelete(row.original.user.id)}
            >
              <Trash className="w-4 h-4" />
            </Button>
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
