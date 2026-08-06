import type { Session } from '@supabase/supabase-js';

export const PASSWORD_RECOVERY_COOKIE = 'cip_password_recovery';
export const PASSWORD_RESET_INVALID_MESSAGE =
  'This password reset link is invalid or has expired.';
export const PASSWORD_RESET_SUCCESS_MESSAGE =
  'Password updated successfully. Please sign in with your new password.';
export const MIN_PASSWORD_LENGTH = 6;

export type PasswordUpdateValidationResult = { ok: true } | { ok: false; error: string };

export function validatePasswordUpdate({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}): PasswordUpdateValidationResult {
  if (!password) {
    return { ok: false, error: 'Password is required.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (!confirmPassword) {
    return { ok: false, error: 'Please confirm your new password.' };
  }

  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }

  return { ok: true };
}

/** True when the URL looks like a Supabase recovery redirect. */
export function hasPasswordRecoveryParams(search: string, hash = ''): boolean {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  if (query.get('error') || query.get('error_description') || hashParams.get('error')) {
    return true;
  }

  if (query.get('code')) {
    return true;
  }

  if (query.get('token_hash') && query.get('type') === 'recovery') {
    return true;
  }

  if (hashParams.get('type') === 'recovery' && (hashParams.get('access_token') || hashParams.get('refresh_token'))) {
    return true;
  }

  return false;
}

/**
 * Best-effort recovery detection from a session JWT `amr` claim.
 * Cookie + PASSWORD_RECOVERY event remain the primary signals.
 */
export function sessionLooksLikePasswordRecovery(session: Session | null | undefined): boolean {
  if (!session?.access_token) return false;

  try {
    const payloadPart = session.access_token.split('.')[1];
    if (!payloadPart) return false;
    const json = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))) as {
      amr?: Array<{ method?: string }>;
    };
    return Array.isArray(json.amr) && json.amr.some((entry) => entry?.method === 'recovery');
  } catch {
    return false;
  }
}

export function markPasswordRecoveryActive() {
  if (typeof document === 'undefined') return;
  document.cookie = `${PASSWORD_RECOVERY_COOKIE}=1; Path=/; Max-Age=3600; SameSite=Lax`;
}

export function clearPasswordRecoveryMarker() {
  if (typeof document === 'undefined') return;
  document.cookie = `${PASSWORD_RECOVERY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function isPasswordRecoveryCookieSet(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((part) => part.trim() === `${PASSWORD_RECOVERY_COOKIE}=1`);
}
