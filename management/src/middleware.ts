import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/login'];
  const isPublicPath = publicPaths.includes(pathname);
  const isSuperAdminPath = pathname.startsWith('/super-admin');
  const isTrainingPath = pathname.startsWith('/training');
  const isSettingsPath = pathname.startsWith('/settings');
  const isAdminPath = pathname.startsWith('/admin');
  const isDashboardPath = pathname === '/';

  // If user is on a public path and has a token, redirect to home (let client-side handle role-based routing)
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is trying to access super admin paths without token, redirect to login
  if (isSuperAdminPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is not on a public path or super admin path and doesn't have a token, redirect to login
  if (!isPublicPath && !isSuperAdminPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Configure which paths this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Include super-admin routes for proper access control
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
