import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POST_AUTH_PATH, getSafePostAuthPath, validateAuthForm } from '@/lib/auth';
import { resolveAppOrigin } from '@/lib/app-origin';
import { getSignupEmailRedirectTo, getLoginUrlAfterVerification } from '@/lib/auth-redirect';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  EMAIL_VERIFIED_SUCCESS_MESSAGE,
  isDuplicateSignupResponse,
  mapAuthError,
} from '@/lib/auth-errors';

describe('isDuplicateSignupResponse', () => {
  it('detects an existing email when identities is empty', () => {
    expect(isDuplicateSignupResponse({ identities: [] })).toBe(true);
  });

  it('treats a new signup user as not duplicate', () => {
    expect(isDuplicateSignupResponse({ identities: [{ id: 'provider-1' }] })).toBe(false);
    expect(isDuplicateSignupResponse(null)).toBe(false);
  });
});

describe('mapAuthError', () => {
  it('maps already-registered Supabase errors to the signup message', () => {
    expect(mapAuthError('User already registered')).toBe(EMAIL_ALREADY_REGISTERED_MESSAGE);
    expect(mapAuthError('Email address is already registered')).toBe(EMAIL_ALREADY_REGISTERED_MESSAGE);
  });
});

describe('getSignupEmailRedirectTo', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('builds callback URL from NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    expect(getSignupEmailRedirectTo('http://127.0.0.1:3000')).toBe('http://localhost:3000/auth/callback');
  });

  it('falls back to the client origin when APP_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getSignupEmailRedirectTo('http://localhost:3001')).toBe('http://localhost:3001/auth/callback');
  });
});

describe('getLoginUrlAfterVerification', () => {
  it('sends verified users to the login page with a success flag', () => {
    expect(getLoginUrlAfterVerification('http://localhost:3000', '1')).toBe(
      'http://localhost:3000/login?verified=1',
    );
  });

  it('marks failed verification distinctly', () => {
    expect(getLoginUrlAfterVerification('http://localhost:3000', '0')).toBe(
      'http://localhost:3000/login?verified=0',
    );
  });
});

describe('EMAIL_VERIFIED_SUCCESS_MESSAGE', () => {
  it('matches the required post-verification copy', () => {
    expect(EMAIL_VERIFIED_SUCCESS_MESSAGE).toBe('Email verified successfully. Please sign in.');
  });
});

describe('resolveAppOrigin', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('uses the request origin in development even when APP_URL differs by port', () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    expect(resolveAppOrigin('http://localhost:3001/auth/callback?code=abc')).toBe('http://localhost:3001');
  });
});

describe('getSafePostAuthPath', () => {
  it('defaults to the homepage', () => {
    expect(getSafePostAuthPath(null)).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafePostAuthPath('')).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafePostAuthPath('https://evil.test')).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it('allows protected account destinations', () => {
    expect(getSafePostAuthPath('/dashboard')).toBe('/dashboard');
    expect(getSafePostAuthPath('/profile')).toBe('/profile');
  });

  it('blocks open redirects', () => {
    expect(getSafePostAuthPath('//evil.test')).toBe(DEFAULT_POST_AUTH_PATH);
    expect(getSafePostAuthPath('/admin')).toBe(DEFAULT_POST_AUTH_PATH);
  });
});

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
