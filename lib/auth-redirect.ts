export const AUTH_CALLBACK_PATH = '/auth/callback';

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

/**
 * Email verification redirect target for signUp({ options: { emailRedirectTo } }).
 * Prefer NEXT_PUBLIC_APP_URL so it matches Supabase Site URL / Redirect URLs.
 */
export function getSignupEmailRedirectTo(clientOrigin: string): string {
  const origin = getConfiguredAppOrigin() ?? clientOrigin.replace(/\/$/, '');
  return `${origin}${AUTH_CALLBACK_PATH}`;
}

export function buildLoginUrlAfterVerification(origin: string, verified: '1' | '0'): URL {
  const url = new URL('/login', origin);
  url.searchParams.set('verified', verified);
  return url;
}

export function getLoginUrlAfterVerification(clientOrigin: string, verified: '1' | '0'): string {
  return buildLoginUrlAfterVerification(clientOrigin, verified).toString();
}
