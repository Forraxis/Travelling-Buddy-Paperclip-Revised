import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  listAuditLogsAction,
  listAuditActorsAction,
} from '@/modules/admin/actions/audit.actions';
import { AuditLogView } from './_components/AuditLogView';

export const metadata = {
  title: 'Audit Log — Admin',
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const adminUser = await getAdminUser();
  if (!adminUser) redirect('/auth/signin');

  const params = await searchParams;

  const filters = {
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  const [{ entries, nextCursor }, actors] = await Promise.all([
    listAuditLogsAction(filters),
    listAuditActorsAction(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Audit Log"
        description="Read-only record of all admin and moderation actions."
      />
      <AuditLogView
        initialEntries={entries}
        initialNextCursor={nextCursor}
        actors={actors}
        isModerator={adminUser.role === 'MODERATOR'}
      />
    </div>
  );
}
