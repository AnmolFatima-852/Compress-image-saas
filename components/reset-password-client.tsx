'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthForm } from '@/components/auth-form';
import { UpdatePasswordForm } from '@/components/update-password-form';
import {
  clearPasswordRecoveryMarker,
  hasPasswordRecoveryParams,
  markPasswordRecoveryActive,
  PASSWORD_RESET_INVALID_MESSAGE,
  sessionLooksLikePasswordRecovery,
} from '@/lib/password-reset';
import { getSupabaseClient } from '@/lib/supabase';
import { alertError, textBody, textLink } from '@/lib/ui-text';

type ResetView = 'loading' | 'request' | 'update' | 'invalid';

function stripAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  ['code', 'token_hash', 'type', 'error', 'error_description', 'error_code'].forEach((key) => {
    url.searchParams.delete(key);
  });
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export function ResetPasswordClient() {
  const [view, setView] = useState<ResetView>('loading');
  const [requestMode, setRequestMode] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setView('request');
      return;
    }

    let cancelled = false;
    const search = window.location.search;
    const hash = window.location.hash;
    const looksLikeRecoveryLink = hasPasswordRecoveryParams(search, hash);

    const enterUpdate = () => {
      if (cancelled) return;
      markPasswordRecoveryActive();
      setView('update');
    };

    const enterInvalid = () => {
      if (cancelled) return;
      clearPasswordRecoveryMarker();
      setView('invalid');
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        enterUpdate();
        return;
      }

      if (event === 'SIGNED_IN' && sessionLooksLikePasswordRecovery(session)) {
        enterUpdate();
      }
    });

    const bootstrap = async () => {
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

      const authError =
        params.get('error_description') ||
        params.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (authError) {
        enterInvalid();
        stripAuthParamsFromUrl();
        return;
      }

      try {
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const otpType = params.get('type');

        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) {
            enterInvalid();
            stripAuthParamsFromUrl();
            return;
          }
          stripAuthParamsFromUrl();
          enterUpdate();
          return;
        }

        if (tokenHash && otpType === 'recovery') {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) {
            enterInvalid();
            stripAuthParamsFromUrl();
            return;
          }
          stripAuthParamsFromUrl();
          enterUpdate();
          return;
        }

        // Implicit / hash-based recovery: let the client parse the URL, then inspect session.
        if (hashParams.get('type') === 'recovery') {
          const { data, error } = await client.auth.getSession();
          if (error || !data.session) {
            enterInvalid();
            stripAuthParamsFromUrl();
            return;
          }
          stripAuthParamsFromUrl();
          enterUpdate();
          return;
        }

        const { data } = await client.auth.getSession();
        if (sessionLooksLikePasswordRecovery(data.session)) {
          enterUpdate();
          return;
        }

        if (looksLikeRecoveryLink) {
          enterInvalid();
          return;
        }

        if (!cancelled) {
          setView('request');
        }
      } catch {
        if (looksLikeRecoveryLink) {
          enterInvalid();
        } else if (!cancelled) {
          setView('request');
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (view === 'loading') {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        Verifying reset link…
      </div>
    );
  }

  if (view === 'invalid' && !requestMode) {
    return (
      <div className="mt-6 space-y-4">
        <div className={alertError}>{PASSWORD_RESET_INVALID_MESSAGE}</div>
        <p className={`text-sm ${textBody}`}>
          Request a new reset email below, or return to sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            clearPasswordRecoveryMarker();
            setRequestMode(true);
            setView('request');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 font-semibold text-white"
        >
          Request another reset email
        </button>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <Link href="/login" className={textLink}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (view === 'update') {
    return (
      <>
        <p className={`mt-2 text-sm ${textBody}`}>
          Choose a new password for your account. You will sign in again after updating.
        </p>
        <UpdatePasswordForm
          onInvalidSession={() => {
            clearPasswordRecoveryMarker();
            setRequestMode(false);
            setView('invalid');
          }}
        />
      </>
    );
  }

  return (
    <>
      <p className={`mt-2 text-sm ${textBody}`}>
        Enter your email and we will send reset instructions.
      </p>
      <AuthForm mode="reset" />
    </>
  );
}
