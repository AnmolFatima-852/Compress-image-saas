'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    if (!client) {
      router.replace('/login');
      return;
    }

    let initialResolved = false;

    const allow = () => {
      if (!active) return;
      setReady(true);
    };

    const deny = (canRedirect: boolean) => {
      if (!active) return;
      setReady(false);
      if (canRedirect) {
        router.replace('/login');
      }
    };

    const verifyUser = async (canRedirect: boolean) => {
      const { data, error } = await client.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        deny(canRedirect);
        return;
      }

      allow();
    };

    void verifyUser(true).then(() => {
      initialResolved = true;
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!initialResolved && event !== 'INITIAL_SESSION') {
        return;
      }

      if (event === 'SIGNED_OUT') {
        initialResolved = true;
        deny(true);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        initialResolved = true;
        allow();
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        initialResolved = true;
        void verifyUser(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
          Checking your session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
