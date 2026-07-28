import type { Route } from 'next';

export type AuthMode = 'login' | 'signup' | 'reset';

export const DEFAULT_POST_AUTH_PATH = '/' as const satisfies Route;

export const PROTECTED_APP_PATH_PREFIXES = ['/dashboard', '/profile'] as const;

/** Allowed post-login destinations (open redirects blocked). */
export function getSafePostAuthPath(next: string | null): Route {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_POST_AUTH_PATH;
  }

  if (next === DEFAULT_POST_AUTH_PATH) {
    return DEFAULT_POST_AUTH_PATH;
  }

  const isProtectedDestination = PROTECTED_APP_PATH_PREFIXES.some(
    (prefix) => next === prefix || next.startsWith(`${prefix}/`),
  );

  if (!isProtectedDestination) {
    return DEFAULT_POST_AUTH_PATH;
  }

  return next as Route;
}

export function getAuthCallbackUrl(origin: string) {
  const normalized = origin.trim().replace(/\/$/, '');
  return `${normalized}/auth/callback`;
}

export type AuthValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateAuthForm({
  email,
  password,
  mode,
  fullName,
}: {
  email: string;
  password: string;
  mode: AuthMode;
  fullName?: string;
}): AuthValidationResult {
  if (!email.trim()) {
    return { ok: false, error: 'Email is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  if (mode !== 'reset' && !password) {
    return { ok: false, error: 'Password is required.' };
  }

  if (mode !== 'reset' && password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  if (mode === 'signup' && !fullName?.trim()) {
    return { ok: false, error: 'Full name is required.' };
  }

  return { ok: true };
}

export function getStoredUser() {
  return null;
}
