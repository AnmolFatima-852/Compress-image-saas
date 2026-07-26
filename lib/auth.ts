export type AuthMode = 'login' | 'signup' | 'reset';

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
