'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getLoginUrlAfterVerification } from '@/lib/auth-redirect';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Handles Supabase email verification redirects (?code=, token_hash, or hash session).
 * Keeps post-verify navigation on the current origin (avoids bad cross-port redirects).
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Confirming your email…');

  useEffect(() => {
    let active = true;

    const finish = (verified: '1' | '0') => {
      if (!active) return;
      window.location.replace(getLoginUrlAfterVerification(window.location.origin, verified));
    };

    const run = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setStatus('Authentication is not configured.');
        finish('0');
        return;
      }

      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get('code');
      const tokenHash = currentUrl.searchParams.get('token_hash');
      const otpType = currentUrl.searchParams.get('type');
      const authError = currentUrl.searchParams.get('error_description') ?? currentUrl.searchParams.get('error');

      if (authError) {
        finish('0');
        return;
      }

      try {
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && otpType) {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as EmailOtpType,
          });
          if (error) throw error;
        } else {
          const { data: { session }, error } = await client.auth.getSession();
          if (error || !session) {
            throw error ?? new Error('Missing verification parameters.');
          }
        }

        await client.auth.signOut();
        finish('1');
      } catch {
        finish('0');
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-slate-700 dark:text-slate-200">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <Loader2 size={18} className="animate-spin" />
        {status}
      </div>
    </main>
  );
}
