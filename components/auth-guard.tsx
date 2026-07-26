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

    const verifySession = async () => {
      if (!client) {
        router.replace('/login');
        return;
      }

      const {\n        data: { session },
        error,
      } = await client.auth.getSession();

      if (!active) return;

      if (error || !session) {
        router.replace('/login');
        return;
      }

      setReady(true);
    };

    void verifySession();

    return () => {
      active = false;
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
