'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensureProfileForUser } from '@/lib/ensure-profile';
export type ProfileData = {
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

export async function getProfileData(): Promise<ProfileData | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  await ensureProfileForUser(supabase, user);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  return {
    email: user.email ?? '',
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? '',
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export async function updateProfileFullName(fullName: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, error: 'Authentication is unavailable.' };
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return { ok: false as const, error: 'Full name is required.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'You must be signed in to update your profile.' };
  }

  await ensureProfileForUser(supabase, user);

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: trimmed,
    },
    { onConflict: 'id' },
  );

  if (error) {
    return { ok: false as const, error: error.message };
  }

  await supabase.auth.updateUser({ data: { full_name: trimmed } });

  return { ok: true as const };
}

export async function updateProfileAvatar(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, error: 'Authentication is unavailable.' };
  }

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: 'Choose an image file for your avatar.' };
  }

  if (!file.type.startsWith('image/')) {
    return { ok: false as const, error: 'Avatar must be an image file.' };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { ok: false as const, error: 'Avatar must be 2 MB or smaller.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'You must be signed in to update your avatar.' };
  }

  await ensureProfileForUser(supabase, user);

  const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const storagePath = `${user.id}/avatar.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from('avatars').upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false as const, error: uploadError.message };
  }

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(storagePath);

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      avatar_url: publicUrl.publicUrl,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  return { ok: true as const, avatarUrl: publicUrl.publicUrl };
}
