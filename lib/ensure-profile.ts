import type { SupabaseClient, User } from '@supabase/supabase-js';

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[supabase]', ...args);
  }
}

/**
 * Ensures profiles + user_settings rows exist for the authenticated user.
 * Links Supabase Auth → public.profiles / public.user_settings.
 */
export async function ensureProfileForUser(supabase: SupabaseClient, user: User) {
  const fullName = user.user_metadata?.full_name;
  const normalizedName =
    typeof fullName === 'string' && fullName.trim().length > 0 ? fullName.trim() : null;

  const { data: existingProfile, error: profileSelectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileSelectError) {
    logDev('profiles select failed:', profileSelectError.message);
  }

  if (!existingProfile) {
    const { error: profileInsertError } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: normalizedName,
    });

    if (profileInsertError) {
      logDev('profiles insert failed:', profileInsertError.message);
    }
  }

  const { data: existingSettings, error: settingsSelectError } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (settingsSelectError) {
    logDev('user_settings select failed:', settingsSelectError.message);
  }

  if (!existingSettings) {
    const { error: settingsInsertError } = await supabase.from('user_settings').insert({
      user_id: user.id,
    });

    if (settingsInsertError) {
      logDev('user_settings insert failed:', settingsInsertError.message);
    }
  }
}
