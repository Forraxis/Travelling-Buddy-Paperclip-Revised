import { auth } from '@/lib/auth';

export type AdminRole = 'ADMIN' | 'MODERATOR';

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: AdminRole;
  avatarUrl?: string | null;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'MODERATOR') return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: role as AdminRole,
    avatarUrl: session.user.image ?? null,
  };
}

export function isAdminOrModerator(user: AdminUser | null): user is AdminUser {
  return user !== null && (user.role === 'ADMIN' || user.role === 'MODERATOR');
}
