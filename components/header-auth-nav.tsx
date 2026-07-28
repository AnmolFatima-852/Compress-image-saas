'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

type AuthNavState = 'guest' | 'authenticated';

const linkClass =
  'rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:text-violet-400';

const primaryClass =
  'rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white shadow-sm';

/**
 * Homepage auth actions. Defaults to guest — never assumes a signed-in user.
 * Confirms identity with getUser() and stays in sync via onAuthStateChange.
 */
export function HeaderAuthNav() {
  const [state, setState] = useState<AuthNavState>('guest');

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) {
      setState('guest');
      return;
    }

    let active = true;

    const applySession = (isAuthenticated: boolean) => {
      if (!active) return;
      setState(isAuthenticated ? 'authenticated' : 'guest');
    };

    const verifyUser = async () => {
      // Server-validated user check — cookie-only getSession() can be stale after failed logouts.
      const { data, error } = await client.auth.getUser();
      if (!active) return;
      applySession(Boolean(!error && data.user));
    };

    void verifyUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === 'SIGNED_OUT') {
        applySession(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        applySession(Boolean(session?.user));
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void verifyUser();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    setState('guest');

    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut({ scope: 'global' });
    }

    window.location.assign('/auth/logout');
  };

  if (state === 'guest') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/login" className={linkClass}>
          Log in
        </Link>
        <Link href="/signup" className={primaryClass}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link href="/dashboard" className={linkClass}>
        Dashboard
      </Link>
      <Link href="/profile" className={primaryClass}>
        Profile
      </Link>
      <button type="button" onClick={() => void handleLogout()} className={linkClass}>
        Log out
      </button>
    </div>
  );
}
