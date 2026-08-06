import { describe, expect, it, afterEach } from 'vitest';
import {
  getPasswordResetRedirectTo,
  getLoginUrlAfterPasswordReset,
} from '@/lib/auth-redirect';
import {
  hasPasswordRecoveryParams,
  PASSWORD_RESET_INVALID_MESSAGE,
  validatePasswordUpdate,
} from '@/lib/password-reset';

describe('getPasswordResetRedirectTo', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('uses NEXT_PUBLIC_APP_URL/reset-password when configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    expect(getPasswordResetRedirectTo('http://127.0.0.1:3000')).toBe('http://localhost:3000/reset-password');
  });

  it('falls back to the client origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getPasswordResetRedirectTo('http://localhost:3001')).toBe('http://localhost:3001/reset-password');
  });
});

describe('getLoginUrlAfterPasswordReset', () => {
  it('redirects to login with passwordReset flag', () => {
    expect(getLoginUrlAfterPasswordReset('http://localhost:3000')).toBe(
      'http://localhost:3000/login?passwordReset=1',
    );
  });
});

describe('validatePasswordUpdate', () => {
  it('requires matching passwords with minimum length', () => {
    expect(validatePasswordUpdate({ password: '', confirmPassword: '' }).ok).toBe(false);
    expect(validatePasswordUpdate({ password: '12345', confirmPassword: '12345' }).ok).toBe(false);
    expect(validatePasswordUpdate({ password: '123456', confirmPassword: '123457' })).toEqual({
      ok: false,
      error: 'Passwords do not match.',
    });
    expect(validatePasswordUpdate({ password: '123456', confirmPassword: '123456' })).toEqual({ ok: true });
  });
});

describe('hasPasswordRecoveryParams', () => {
  it('detects recovery query and hash params', () => {
    expect(hasPasswordRecoveryParams('?code=abc')).toBe(true);
    expect(hasPasswordRecoveryParams('?token_hash=x&type=recovery')).toBe(true);
    expect(hasPasswordRecoveryParams('', '#access_token=x&type=recovery')).toBe(true);
    expect(hasPasswordRecoveryParams('')).toBe(false);
  });

  it('exposes the required invalid-link copy', () => {
    expect(PASSWORD_RESET_INVALID_MESSAGE).toBe(
      'This password reset link is invalid or has expired.',
    );
  });
});
