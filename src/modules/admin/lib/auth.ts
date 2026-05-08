export type AdminRole = 'ADMIN' | 'MODERATOR';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarUrl?: string;
}

const DEV_ADMIN_USER: AdminUser = {
  id: 'dev-admin-001',
  name: 'Dev Admin',
  email: 'admin@travellingbuddy.dev',
  role: 'ADMIN',
};

const DEV_AUTH_BYPASS = process.env.NODE_ENV === 'development'
  || process.env.TB_DEV_AUTH_BYPASS === 'true';

export function getAdminUser(): AdminUser | null {
  if (DEV_AUTH_BYPASS) {
    return DEV_ADMIN_USER;
  }
  // Phase 9: replace with NextAuth session lookup
  return null;
}

export function isAdminOrModerator(user: AdminUser | null): user is AdminUser {
  return user !== null && (user.role === 'ADMIN' || user.role === 'MODERATOR');
}
