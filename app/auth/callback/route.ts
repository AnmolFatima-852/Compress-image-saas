import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveAppOrigin } from '@/lib/app-origin';
import { buildLoginUrlAfterVerification, RESET_PASSWORD_PATH } from '@/lib/auth-redirect';
import { PASSWORD_RECOVERY_COOKIE } from '@/lib/password-reset';

function sessionHasRecoveryAmr(accessToken: string | undefined): boolean {
  if (!accessToken) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1]!, 'base64url').toString('utf8'),
    ) as { amr?: Array<{ method?: string }> };
    return Array.isArray(payload.amr) && payload.amr.some((entry) => entry?.method === 'recovery');
  } catch {
    return false;
  }
}

function withRecoveryCookie(response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60,
    sameSite: 'lax',
    httpOnly: false,
  });
  return response;
}

/**
 * Handles Supabase email verification redirects (?code= or token_hash).
 * Recovery links are forwarded to /reset-password (never signed into the app).
 * Signup verification clears the temporary session, then sends the user to /login.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = resolveAppOrigin(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const otpType = requestUrl.searchParams.get('type');
  const authError =
    requestUrl.searchParams.get('error_description') ?? requestUrl.searchParams.get('error');

  const redirectToLogin = (verified: '1' | '0') =>
    NextResponse.redirect(buildLoginUrlAfterVerification(origin, verified));

  const redirectToResetPasswordKeepingParams = () => {
    const url = new URL(RESET_PASSWORD_PATH, origin);
    requestUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return withRecoveryCookie(NextResponse.redirect(url));
  };

  if (authError) {
    if (otpType === 'recovery') {
      return redirectToResetPasswordKeepingParams();
    }
    return redirectToLogin('0');
  }

  // Explicit recovery OTP links must never use the signup verification path.
  if (otpType === 'recovery') {
    return redirectToResetPasswordKeepingParams();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToLogin('0');
  }

  if (!code && !(tokenHash && otpType)) {
    return redirectToLogin('0');
  }

  let response = redirectToLogin('1');

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      if (sessionHasRecoveryAmr(data.session?.access_token)) {
        const resetResponse = NextResponse.redirect(new URL(RESET_PASSWORD_PATH, origin));
        response.cookies.getAll().forEach(({ name, value }) => {
          resetResponse.cookies.set(name, value);
        });
        return withRecoveryCookie(resetResponse);
      }

      // Signup / email verification: clear the temporary session so the user signs in explicitly.
      await supabase.auth.signOut();
      return response;
    }

    if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as EmailOtpType,
      });
      if (error) throw error;
    }

    await supabase.auth.signOut();
    return response;
  } catch {
    return redirectToLogin('0');
  }
}
