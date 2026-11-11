import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'cou_ai_hackathon_session';

/** Route prefix -> roles that may access it. */
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/team': ['team', 'super_admin'],
  '/judge': ['judge', 'super_admin'],
  '/admin': ['super_admin', 'moderator'],
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const entry = Object.entries(PROTECTED_ROUTES).find(([path]) => pathname.startsWith(path));
  if (!entry) return NextResponse.next();

  const [path, allowedRoles] = entry;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl =
      path === '/team' ? new URL('/login', req.url) : new URL('/staff-login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = payload.role as string | undefined;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL('/staff-login', req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/team/:path*', '/judge/:path*', '/admin/:path*'],
};
