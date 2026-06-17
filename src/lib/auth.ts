import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import type { UserRole, TrustTier, AustralianState } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      trustTier: TrustTier;
      homeState: AustralianState | null;
    };
  }

  interface User {
    role: UserRole;
    trustTier: TrustTier;
    homeState: AustralianState | null;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    trustTier: TrustTier;
    homeState: AustralianState | null;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // Auth.js derives `useSecureCookies` from the (https) AUTH_URL, so it sets
  // `__Secure-`/`Secure` session cookies even in local dev. Browsers silently
  // DROP those over plain http://localhost — the server "logs you in" but the
  // cookie never sticks, so you appear logged out. Force non-secure cookies in
  // dev (works over http localhost AND the https proxy); keep secure in prod.
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (
          typeof credentials?.email !== 'string' ||
          typeof credentials?.password !== 'string'
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            role: true,
            trustTier: true,
            homeState: true,
            deletedAt: true,
          },
        });

        if (!user?.password) return null;
        if (user.deletedAt) throw new Error('ACCOUNT_DELETED');

        const valid = await verifyPassword(credentials.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          trustTier: user.trustTier,
          homeState: user.homeState,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { deletedAt: true },
        });
        if (dbUser?.deletedAt) return '/auth/signin?error=ACCOUNT_DELETED';
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        if (user.role !== undefined) {
          // Credentials provider: authorize() returns custom fields directly
          token.role = user.role;
          token.trustTier = user.trustTier;
          token.homeState = user.homeState;
        } else {
          // OAuth provider: Auth.js strips custom fields from the adapter user
          // before passing to this callback — fetch them from the database.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id! },
            select: { role: true, trustTier: true, homeState: true },
          });
          token.role = dbUser?.role ?? 'VIEWER';
          token.trustTier = dbUser?.trustTier ?? 'NEW';
          token.homeState = dbUser?.homeState ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.trustTier = token.trustTier;
      session.user.homeState = token.homeState;
      return session;
    },
  },
});
