'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  DataTableShell,
  type DataTableColumn,
} from '@/modules/admin/components';
import { selectClassName, inputClassName } from '@/modules/admin/components';
import {
  listAuditLogsAction,
  type AuditLogEntry,
  type AuditActorOption,
} from '@/modules/admin/actions/audit.actions';

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;

const ENTITY_TYPE_OPTIONS = [
  'vehicle',
  'caravan',
  'accessory',
  'submission',
  'regulation',
  'sponsor',
  'placement',
];

function entityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'vehicle':
      return `/admin/catalogue/vehicles`;
    case 'caravan':
      return `/admin/catalogue/caravans`;
    case 'accessory':
      return `/admin/catalogue/accessories`;
    case 'submission':
      return `/admin/submissions`;
    case 'regulation':
      return `/admin/operations/regulations`;
    case 'sponsor':
      return `/admin/sponsorship/sponsors`;
    case 'placement':
      return `/admin/sponsorship/placements`;
    default:
      return null;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
}

function ActionBadge({ action }: { action: string }) {
  const colours: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colours[action] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {action}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colours: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    MODERATOR: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colours[role] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {role}
    </span>
  );
}

interface Props {
  initialEntries: AuditLogEntry[];
  initialNextCursor: string | null;
  actors: AuditActorOption[];
  isModerator: boolean;
}

export function AuditLogView({
  initialEntries,
  initialNextCursor,
  actors,
  isModerator,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const currentFilters = {
    actorId: searchParams.get('actorId') ?? '',
    action: searchParams.get('action') ?? '',
    entityType: searchParams.get('entityType') ?? '',
    entityId: searchParams.get('entityId') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
  };

  const pushFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('cursor');
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const result = await listAuditLogsAction({
      actorId: currentFilters.actorId || undefined,
      action: currentFilters.action || undefined,
      entityType: currentFilters.entityType || undefined,
      entityId: currentFilters.entityId || undefined,
      dateFrom: currentFilters.dateFrom || undefined,
      dateTo: currentFilters.dateTo || undefined,
      cursor: nextCursor,
    });
    setEntries((prev) => [...prev, ...result.entries]);
    setNextCursor(result.nextCursor);
    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, currentFilters]);

  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-xs whitespace-nowrap text-gray-500">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <span className="text-sm whitespace-nowrap">
          {row.user.name ?? row.user.email ?? row.changedBy}
          <RoleBadge role={row.user.role} />
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'entityType',
      header: 'Entity Type',
      render: (row) => (
        <span className="text-sm text-gray-700 capitalize">
          {row.entityType}
        </span>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity',
      render: (row) => {
        const href = entityLink(row.entityType, row.entityId);
        return href ? (
          <Link
            href={href}
            className="font-mono text-xs text-blue-600 hover:underline"
          >
            {row.entityId}
          </Link>
        ) : (
          <span className="font-mono text-xs text-gray-500">
            {row.entityId}
          </span>
        );
      },
    },
    {
      key: 'reason',
      header: 'Summary',
      render: (row) => (
        <span className="max-w-xs truncate text-sm text-gray-600">
          {row.reason ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {!isModerator && (
          <select
            className={selectClassName}
            value={currentFilters.actorId}
            onChange={(e) => pushFilter('actorId', e.target.value)}
          >
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email ?? a.id}
              </option>
            ))}
          </select>
        )}

        <select
          className={selectClassName}
          value={currentFilters.action}
          onChange={(e) => pushFilter('action', e.target.value)}
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          className={selectClassName}
          value={currentFilters.entityType}
          onChange={(e) => pushFilter('entityType', e.target.value)}
        >
          <option value="">All entity types</option>
          {ENTITY_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          className={inputClassName}
          placeholder="Search entity ID…"
          value={currentFilters.entityId}
          onChange={(e) => pushFilter('entityId', e.target.value)}
        />

        <input
          type="date"
          className={inputClassName}
          value={currentFilters.dateFrom}
          onChange={(e) => pushFilter('dateFrom', e.target.value)}
          title="From date"
        />

        <input
          type="date"
          className={inputClassName}
          value={currentFilters.dateTo}
          onChange={(e) => pushFilter('dateTo', e.target.value)}
          title="To date"
        />
      </div>

      <div className={isPending ? 'opacity-60 transition-opacity' : ''}>
        <DataTableShell
          columns={columns}
          data={entries}
          emptyMessage="No audit log entries match the current filters."
        />
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
