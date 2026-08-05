import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveAppOrigin } from '@/lib/app-origin';
import { buildLoginUrlAfterVerification } from '@/lib/auth-redirect';

/**
 * Handles Supabase email verification redirects (?code= or token_hash),
 * clears the temporary session, then sends the user to /login to sign in.
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

  if (authError) {
    return redirectToLogin('0');
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
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as EmailOtpType,
      });
      if (error) throw error;
    }

    // Verification creates a session — clear it so the user explicitly signs in.
    await supabase.auth.signOut();
    return response;
  } catch {
    return redirectToLogin('0');
  }
}
