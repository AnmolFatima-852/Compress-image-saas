import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_POST_AUTH_PATH } from '@/lib/auth';
import { AUTH_CALLBACK_PATH, RESET_PASSWORD_PATH } from '@/lib/auth-redirect';
import { isPasswordRecoveryCookieSet } from '@/lib/password-reset';

const PROTECTED_PREFIXES = ['/dashboard', '/profile'] as const;
const AUTH_PAGES = ['/login', '/signup'] as const;

/** Supabase may land email links on Site URL (/) — forward to the correct handler. */
function hasAuthRedirectParams(url: URL) {
  return Boolean(
    url.searchParams.get('code') ||
      (url.searchParams.get('token_hash') && url.searchParams.get('type')) ||
      url.searchParams.get('error_description') ||
      url.searchParams.get('error'),
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
  const cookieHeader = request.headers.get('cookie');
  const isRecoveryFlow = isPasswordRecoveryCookieSet(cookieHeader);

  if (pathname === '/' && hasAuthRedirectParams(request.nextUrl)) {
    const type = request.nextUrl.searchParams.get('type');
    const targetPath = type === 'recovery' ? RESET_PASSWORD_PATH : AUTH_CALLBACK_PATH;
    const targetUrl = new URL(targetPath, request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(targetUrl);
  }

  // Recovery sessions may only use the reset-password page until the password is changed.
  if (isRecoveryFlow && pathname !== RESET_PASSWORD_PATH && pathname !== AUTH_CALLBACK_PATH) {
    return NextResponse.redirect(new URL(RESET_PASSWORD_PATH, request.url));
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

  // Never bounce recovery users from /reset-password into the app.
  if (pathname === RESET_PASSWORD_PATH) {
    return supabaseResponse;
  }

  if (user && isAuthPage(pathname)) {
    const verified = request.nextUrl.searchParams.get('verified');
    const passwordReset = request.nextUrl.searchParams.get('passwordReset');

    if (pathname === '/login' && (verified === '1' || passwordReset === '1')) {
      return supabaseResponse;
    }

    if (isRecoveryFlow) {
      return redirectWithSessionCookies(new URL(RESET_PASSWORD_PATH, request.url), supabaseResponse);
    }

    return redirectWithSessionCookies(new URL(DEFAULT_POST_AUTH_PATH, request.url), supabaseResponse);
  }

  // Signed-in users hitting the homepage/app with an active recovery marker stay gated above.
  if (user && isRecoveryFlow) {
    return redirectWithSessionCookies(new URL(RESET_PASSWORD_PATH, request.url), supabaseResponse);
  }

  return supabaseResponse;
}
