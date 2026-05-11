import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === 'development' ||
  process.env.TB_DEV_AUTH_BYPASS === 'true';

const PROTECTED_PAGES = [/^\/account(\/|$)/];

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('__Secure-next-auth.session-token') ||
    request.cookies.has('next-auth.session-token')
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (DEV_AUTH_BYPASS) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (PROTECTED_PAGES.some((p) => p.test(pathname)) && !hasSessionCookie(request)) {
    const signIn = new URL('/auth/signin', request.url);
    signIn.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signIn);
  }

  const locale = routing.defaultLocale;
  const headers = new Headers(request.headers);
  headers.set('X-NEXT-INTL-LOCALE', locale);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set('NEXT_LOCALE', locale, { sameSite: 'lax' });

  if (pathname.startsWith('/setup/share/')) {
    response.headers.set('X-Robots-Tag', 'noindex');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
