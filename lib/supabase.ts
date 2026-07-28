import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Returns a browser Supabase client with cookie-backed session persistence.
 * Returns null when required public env vars are missing.
 */
export function getSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env) {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }

  return browserClient;
}

export const supabase = typeof window !== 'undefined' ? getSupabaseClient() : null;
