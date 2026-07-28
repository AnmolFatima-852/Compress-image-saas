import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Ensures a profiles row exists for the authenticated user (links Supabase Auth → public.profiles).
 */
export async function ensureProfileForUser(supabase: SupabaseClient, user: User) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();

  if (existing) {
    return;
  }

  const fullName = user.user_metadata?.full_name;
  const normalizedName =
    typeof fullName === 'string' && fullName.trim().length > 0 ? fullName.trim() : null;

  await supabase.from('profiles').insert({
    id: user.id,
    full_name: normalizedName,
  });
}
