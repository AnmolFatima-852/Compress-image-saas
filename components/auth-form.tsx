'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthMode, validateAuthForm } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase';

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    client.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

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
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/dashboard');
        } else {
          setMessage('Check your inbox for a confirmation email.');
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      {mode === 'signup' ? (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Full name
          <input
            name="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
            placeholder="Jamie Doe"
          />
        </label>
      ) : null}

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
          placeholder="you@example.com"
        />
      </label>

      {mode !== 'reset' ? (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" className="text-slate-500">
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
          <Link href="/reset-password" className="font-semibold text-violet-600">Forgot password?</Link>
        ) : null}
        {mode === 'login' ? (
          <Link href="/signup" className="font-semibold text-violet-600">Create account</Link>
        ) : (
          <Link href="/login" className="font-semibold text-violet-600">Back to sign in</Link>
        )}
      </div>
    </form>
  );
}
