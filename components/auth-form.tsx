'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSignupEmailRedirectTo } from '@/lib/auth-redirect';
import { AuthMode, DEFAULT_POST_AUTH_PATH, getSafePostAuthPath, validateAuthForm } from '@/lib/auth';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  SIGNUP_VERIFY_EMAIL_MESSAGE,
  isDuplicateSignupResponse,
  mapAuthError,
} from '@/lib/auth-errors';
import { alertError, alertSuccess, textLabel, textLink } from '@/lib/ui-text';
import { getSupabaseClient } from '@/lib/supabase';

function getPostAuthPath() {
  if (typeof window === 'undefined') {
    return DEFAULT_POST_AUTH_PATH;
  }

  return getSafePostAuthPath(new URLSearchParams(window.location.search).get('next'));
}

/** Full navigation so middleware receives cookie-backed session on the next request. */
function completeAuthRedirect(path: ReturnType<typeof getPostAuthPath>) {
  window.location.assign(path);
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');

    if (verified === '1') {
      setMessage('Your email is verified. Sign in to continue.');
    } else if (verified === '0') {
      setError('Email verification failed or the link expired. Request a new confirmation email.');
    }

    client.auth.getSession().then(({ data }) => {
      if (data.session && verified !== '1') {
        completeAuthRedirect(getPostAuthPath());
      }
    });
  }, []);

  const validate = () => {
    const result = validateAuthForm({ email, password, mode, fullName });

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!validate()) return;

    setLoading(true);
    const client = getSupabaseClient();

    if (!client) {
      setError('Authentication is unavailable. Check your Supabase environment variables.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email.');
      } else if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: getSignupEmailRedirectTo(window.location.origin),
          },
        });
        if (error) throw error;

        // Duplicate emails often return 200 with an empty identities array and no session.
        if (isDuplicateSignupResponse(data.user)) {
          setError(EMAIL_ALREADY_REGISTERED_MESSAGE);
          return;
        }

        const userId = data.user?.id;
        if (data.session) {
          if (userId) {
            await client.from('profiles').upsert(
              {
                id: userId,
                full_name: fullName.trim(),
              },
              { onConflict: 'id' },
            );
          }
          completeAuthRedirect(getPostAuthPath());
        } else if (data.user) {
          setMessage(SIGNUP_VERIFY_EMAIL_MESSAGE);
        } else {
          setError(EMAIL_ALREADY_REGISTERED_MESSAGE);
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const session = data.session ?? (await client.auth.getSession()).data.session;
        if (session) {
          completeAuthRedirect(getPostAuthPath());
        } else {
          setMessage('Sign-in succeeded. Confirm your email, then sign in again.');
        }
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Authentication failed.';
      setError(mapAuthError(rawMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? <div className={alertError}>{error}</div> : null}
      {message ? <div className={alertSuccess}>{message}</div> : null}

      {mode === 'signup' ? (
        <label className={`block text-sm font-medium ${textLabel}`}>
          Full name
          <input
            name="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
            placeholder="Jamie Doe"
          />
        </label>
      ) : null}

      <label className={`block text-sm font-medium ${textLabel}`}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
          placeholder="you@example.com"
        />
      </label>

      {mode !== 'reset' ? (
        <label className={`block text-sm font-medium ${textLabel}`}>
          Password
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/80">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent text-slate-900 outline-none dark:text-slate-100"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" className="text-slate-500 dark:text-slate-400">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
      ) : null}

      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
        {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400">
        {mode === 'login' ? (
          <Link href="/reset-password" className={textLink}>Forgot password?</Link>
        ) : null}
        {mode === 'login' ? (
          <Link href="/signup" className={textLink}>Create account</Link>
        ) : (
          <Link href="/login" className={textLink}>Back to sign in</Link>
        )}
      </div>
    </form>
  );
}
