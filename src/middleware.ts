import { auth } from '@/lib/auth';

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/signin';
      url.searchParams.set('callbackUrl', pathname);
      return Response.redirect(url);
    }

    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return Response.redirect(url);
    }
  }
});

export const config = {
  matcher: ['/admin/:path*'],
};
