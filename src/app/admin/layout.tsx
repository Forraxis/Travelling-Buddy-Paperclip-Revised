import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminShell } from '@/modules/admin/components/AdminShell';
import { ToastProvider } from '@/modules/admin/components/Toast';
import type { AdminUser } from '@/modules/admin/lib/auth';

export const metadata = {
  title: 'Admin — TravellingBuddy',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    redirect('/');
  }

  const user: AdminUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: role as 'ADMIN' | 'MODERATOR',
    avatarUrl: session.user.image ?? null,
  };

  return (
    <ToastProvider>
      <AdminShell user={user}>{children}</AdminShell>
    </ToastProvider>
  );
}
