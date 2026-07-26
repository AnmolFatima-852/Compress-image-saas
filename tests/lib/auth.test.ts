import { describe, expect, it } from 'vitest';
import { validateAuthForm } from '@/lib/auth';

describe('validateAuthForm', () => {
  it('requires a valid email', () => {
    const result = validateAuthForm({ email: 'invalid', mode: 'login', password: 'secret123' });

    expect(result).toEqual({ ok: false, error: 'Please enter a valid email address.' });
  });

  it('requires a password for login and signup', () => {
    const result = validateAuthForm({ email: 'user@example.com', mode: 'login', password: '' });

    expect(result).toEqual({ ok: false, error: 'Password is required.' });
  });

  it('allows reset mode without a password', () => {
    const result = validateAuthForm({ email: 'user@example.com', mode: 'reset', password: '' });

    expect(result).toEqual({ ok: true });
  });
});
