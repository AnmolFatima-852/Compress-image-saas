import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_POST_AUTH_PATH } from '@/lib/auth';

const PROTECTED_PREFIXES = ['/dashboard', '/profile'] as const;
const AUTH_PAGES = ['/login', '/signup'] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number]);
}

function redirectWithSessionCookies(url: URL, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(url);

  sessionResponse.cookies.getAll().forEach(({ name, value }) => {
    response.cookies.set(name, value);
  });

  return response;
}

/**
 * Refreshes the Supabase auth session from cookies and enforces route guards.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return redirectWithSessionCookies(loginUrl, supabaseResponse);
  }

  if (user && isAuthPage(pathname)) {
    if (pathname === '/login' && request.nextUrl.searchParams.get('verified') === '1') {
      return supabaseResponse;
    }

    return redirectWithSessionCookies(new URL(DEFAULT_POST_AUTH_PATH, request.url), supabaseResponse);
  }

  return supabaseResponse;
}
