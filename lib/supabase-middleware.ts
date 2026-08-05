import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_POST_AUTH_PATH } from '@/lib/auth';
import { AUTH_CALLBACK_PATH } from '@/lib/auth-redirect';

const PROTECTED_PREFIXES = ['/dashboard', '/profile'] as const;
const AUTH_PAGES = ['/login', '/signup'] as const;

/** Supabase may land verification links on Site URL (/) — forward to the callback handler. */
function hasEmailVerificationParams(url: URL) {
  return Boolean(
    url.searchParams.get('code') ||
      (url.searchParams.get('token_hash') && url.searchParams.get('type')) ||
      url.searchParams.get('error_description'),
  );
}

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
  const { pathname } = request.nextUrl;

  if (pathname === '/' && hasEmailVerificationParams(request.nextUrl)) {
    const callbackUrl = new URL(AUTH_CALLBACK_PATH, request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(pathname)) {
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

  if (!user && isProtectedPath(pathname)) {
    return redirectWithSessionCookies(new URL('/login', request.url), supabaseResponse);
  }

  if (user && isAuthPage(pathname)) {
    if (pathname === '/login' && request.nextUrl.searchParams.get('verified') === '1') {
      return supabaseResponse;
    }

    return redirectWithSessionCookies(new URL(DEFAULT_POST_AUTH_PATH, request.url), supabaseResponse);
  }

  return supabaseResponse;
}
