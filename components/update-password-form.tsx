'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getLoginUrlAfterPasswordReset } from '@/lib/auth-redirect';
import { mapAuthError } from '@/lib/auth-errors';
import {
  clearPasswordRecoveryMarker,
  validatePasswordUpdate,
} from '@/lib/password-reset';
import { getSupabaseClient } from '@/lib/supabase';
import { alertError, alertSuccess, textLabel } from '@/lib/ui-text';

type UpdatePasswordFormProps = {
  onInvalidSession: () => void;
};

export function UpdatePasswordForm({ onInvalidSession }: UpdatePasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validation = validatePasswordUpdate({ password, confirmPassword });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError('Authentication is unavailable. Check your Supabase environment variables.');
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        onInvalidSession();
        return;
      }

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Password updated successfully. Redirecting to sign in…');
      clearPasswordRecoveryMarker();
      await client.auth.signOut({ scope: 'global' });
      window.location.assign(getLoginUrlAfterPasswordReset(window.location.origin));
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Unable to update password.';
      const mapped = mapAuthError(rawMessage);
      if (
        mapped.toLowerCase().includes('session') ||
        mapped.toLowerCase().includes('auth session missing') ||
        mapped.toLowerCase().includes('not authenticated')
      ) {
        onInvalidSession();
        return;
      }
      setError(mapped);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? <div className={alertError}>{error}</div> : null}
      {message ? <div className={alertSuccess}>{message}</div> : null}

      <label className={`block text-sm font-medium ${textLabel}`}>
        New Password
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/80">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-transparent text-slate-900 outline-none dark:text-slate-100"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label="Toggle new password visibility"
            className="text-slate-500 dark:text-slate-400"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <label className={`block text-sm font-medium ${textLabel}`}>
        Confirm Password
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/80">
          <input
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full bg-transparent text-slate-900 outline-none dark:text-slate-100"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            aria-label="Toggle confirm password visibility"
            className="text-slate-500 dark:text-slate-400"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
        Update Password
      </button>
    </form>
  );
}
