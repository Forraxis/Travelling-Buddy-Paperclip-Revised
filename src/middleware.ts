import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === 'development' ||
  process.env.TB_DEV_AUTH_BYPASS === 'true';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (DEV_AUTH_BYPASS) {
      return NextResponse.next();
    }

    // Phase 9: replace with NextAuth session check
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
