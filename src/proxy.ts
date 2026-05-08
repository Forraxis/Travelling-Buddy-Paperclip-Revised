import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === 'development' ||
  process.env.TB_DEV_AUTH_BYPASS === 'true';

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

  // Set X-NEXT-INTL-LOCALE header so next-intl server functions (getLocale, getMessages)
  // can resolve the locale without createIntlMiddleware rewriting paths.
  // createIntlMiddleware is incompatible with Next.js 16's proxy convention.
  const locale = routing.defaultLocale;
  const headers = new Headers(request.headers);
  headers.set('X-NEXT-INTL-LOCALE', locale);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set('NEXT_LOCALE', locale, { sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
