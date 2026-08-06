export const AUTH_CALLBACK_PATH = '/auth/callback';
export const RESET_PASSWORD_PATH = '/reset-password';

export function getConfiguredAppOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolvePublicOrigin(clientOrigin: string): string {
  return getConfiguredAppOrigin() ?? clientOrigin.replace(/\/$/, '');
}

/**
 * Email verification redirect target for signUp({ options: { emailRedirectTo } }).
 * Prefer NEXT_PUBLIC_APP_URL so it matches Supabase Site URL / Redirect URLs.
 */
export function getSignupEmailRedirectTo(clientOrigin: string): string {
  const origin = resolvePublicOrigin(clientOrigin);
  return `${origin}${AUTH_CALLBACK_PATH}`;
}

/**
 * Password recovery email redirect: lands on /reset-password (never the homepage).
 */
export function getPasswordResetRedirectTo(clientOrigin: string): string {
  const origin = resolvePublicOrigin(clientOrigin);
  return `${origin}${RESET_PASSWORD_PATH}`;
}

export function buildLoginUrlAfterVerification(origin: string, verified: '1' | '0'): URL {
  const url = new URL('/login', origin);
  url.searchParams.set('verified', verified);
  return url;
}

export function getLoginUrlAfterVerification(clientOrigin: string, verified: '1' | '0'): string {
  return buildLoginUrlAfterVerification(clientOrigin, verified).toString();
}

export function buildLoginUrlAfterPasswordReset(origin: string): URL {
  const url = new URL('/login', origin);
  url.searchParams.set('passwordReset', '1');
  return url;
}

export function getLoginUrlAfterPasswordReset(clientOrigin: string): string {
  return buildLoginUrlAfterPasswordReset(clientOrigin).toString();
}
