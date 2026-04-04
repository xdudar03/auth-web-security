'use client';

import { useMemo, useState } from 'react';
import { useTRPC } from '@/hooks/TrpcContext';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, RefreshCcw, Search } from 'lucide-react';

type UserActivityRow = {
  id: number;
  userId: string;
  activity: string;
  createdAt: string;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export default function UsersActivity() {
  const trpc = useTRPC();
  const [draftUserId, setDraftUserId] = useState('');
  const [draftActivity, setDraftActivity] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');

  const hasUserFilter = userIdFilter.length > 0;
  const hasActivityFilter = activityFilter.length > 0;

  const allActivityQuery = useQuery({
    ...trpc.admin.getAllUserActivity.queryOptions(),
    enabled: !hasUserFilter && !hasActivityFilter,
  });

  const activityByUserQuery = useQuery({
    ...trpc.admin.getUserActivity.queryOptions({ userId: userIdFilter }),
    enabled: hasUserFilter,
  });

  const activityByNameQuery = useQuery({
    ...trpc.admin.getUserActivityByActivity.queryOptions({
      activity: activityFilter,
    }),
    enabled: !hasUserFilter && hasActivityFilter,
  });

  const activeQuery = hasUserFilter
    ? activityByUserQuery
    : hasActivityFilter
      ? activityByNameQuery
      : allActivityQuery;

  const rows = useMemo(() => {
    const queryRows = (activeQuery.data ?? []) as UserActivityRow[];
    const normalizedActivityFilter = activityFilter.trim().toLowerCase();
    const filteredRows =
      hasUserFilter && hasActivityFilter
        ? queryRows.filter((row) =>
            row.activity.toLowerCase().includes(normalizedActivityFilter)
          )
        : queryRows;

    return [...filteredRows].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [activeQuery.data, activityFilter, hasActivityFilter, hasUserFilter]);

  const uniqueUsers = useMemo(
    () => new Set(rows.map((row) => row.userId)).size,
    [rows]
  );

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    console.log('handleSearch', draftUserId, draftActivity);
    event.preventDefault();
    setUserIdFilter(draftUserId.trim());
    setActivityFilter(draftActivity.trim());
  };

  const handleReset = () => {
    setDraftUserId('');
    setDraftActivity('');
    setUserIdFilter('');
    setActivityFilter('');
  };

  const filterModeLabel = hasUserFilter
    ? hasActivityFilter
      ? 'Filtered by user and activity'
      : 'Filtered by user'
    : hasActivityFilter
      ? 'Filtered by activity'
      : 'Showing all activity';

  return (
    <div className="flex flex-col gap-4 w-full bg-surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Users Activity</h1>
          <p className="text-sm text-muted">{filterModeLabel}</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3.5 w-3.5" />
          {rows.length} event(s)
        </Badge>
      </div>

      <form
        onSubmit={handleSearch}
        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 border-t border-border pt-4"
      >
        <Input
          placeholder="Filter by user ID"
          value={draftUserId}
          onChange={(event) => setDraftUserId(event.target.value)}
        />
        <Input
          placeholder="Filter by activity (e.g. login)"
          value={draftActivity}
          onChange={(event) => setDraftActivity(event.target.value)}
        />
        <Button type="submit" className="gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={handleReset}
        >
          <RefreshCcw className="h-4 w-4" />
          Reset
        </Button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border pt-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total Events
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {rows.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unique Users
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {uniqueUsers}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Loading users activity...
                </TableCell>
              </TableRow>
            ) : activeQuery.error ? (
              <TableRow>
                <TableCell colSpan={3} className="text-error">
                  Failed to load users activity.
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatTimestamp(row.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.userId}
                  </TableCell>
                  <TableCell>{row.activity}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No activity found for the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
