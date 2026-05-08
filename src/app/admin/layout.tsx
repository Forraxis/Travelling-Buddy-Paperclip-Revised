import { redirect } from 'next/navigation';
import { getAdminUser, isAdminOrModerator } from '@/modules/admin/lib/auth';
import { AdminShell } from '@/modules/admin/components/AdminShell';

export const metadata = {
  title: 'Admin — TravellingBuddy',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getAdminUser();

  if (!isAdminOrModerator(user)) {
    redirect('/');
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
