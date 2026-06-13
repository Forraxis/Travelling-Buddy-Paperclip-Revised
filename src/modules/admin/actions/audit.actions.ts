'use server';

import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import type { AuditAction } from '@prisma/client';

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  changedBy: string;
  changes: unknown;
  reason: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
}

export interface AuditActorOption {
  id: string;
  name: string | null;
  email: string | null;
}

const PAGE_SIZE = 50;

export async function listAuditLogsAction(
  filters: AuditLogFilters = {},
): Promise<{ entries: AuditLogEntry[]; nextCursor: string | null }> {
  const adminUser = await getAdminUser();
  if (!adminUser) return { entries: [], nextCursor: null };

  const where: Record<string, unknown> = {};

  if (adminUser.role === 'MODERATOR') {
    where.changedBy = adminUser.id;
  } else if (filters.actorId) {
    where.changedBy = filters.actorId;
  }

  if (filters.action) where.action = filters.action as AuditAction;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = { contains: filters.entityId };

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const rows = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const entries = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? entries[entries.length - 1].id : null;

  return {
    entries: entries.map((r) => ({
      ...r,
      user: {
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        role: r.user.role,
      },
    })),
    nextCursor,
  };
}

export async function listAuditActorsAction(): Promise<AuditActorOption[]> {
  const adminUser = await getAdminUser();
  if (!adminUser) return [];

  if (adminUser.role === 'MODERATOR') {
    return [{ id: adminUser.id, name: adminUser.name, email: adminUser.email }];
  }

  return prisma.user.findMany({
    where: {
      auditLogs: { some: {} },
      role: { in: ['ADMIN', 'MODERATOR'] },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
}
