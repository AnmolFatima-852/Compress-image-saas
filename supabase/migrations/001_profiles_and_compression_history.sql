-- =============================================================================
-- Complete public schema for Compress Image SaaS
-- Run this FIRST in the Supabase SQL Editor (Project → SQL → New query).
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- compression_history (owned by authenticated user)
-- -----------------------------------------------------------------------------
create table if not exists public.compression_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  original_filename text not null,
  original_size bigint not null,
  compressed_size bigint not null,
  saved_space bigint not null default 0,
  compression_ratio text not null,
  image_format text not null,
  width integer not null default 0,
  height integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- Idempotent column add if an older table already exists without saved_space
alter table public.compression_history
  add column if not exists saved_space bigint not null default 0;

create index if not exists compression_history_user_id_created_at_idx
  on public.compression_history (user_id, created_at desc);

alter table public.compression_history enable row level security;

drop policy if exists "Compression history is viewable by owner" on public.compression_history;
create policy "Compression history is viewable by owner"
  on public.compression_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Compression history is insertable by owner" on public.compression_history;
create policy "Compression history is insertable by owner"
  on public.compression_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Compression history is updatable by owner" on public.compression_history;
create policy "Compression history is updatable by owner"
  on public.compression_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Compression history is deletable by owner" on public.compression_history;
create policy "Compression history is deletable by owner"
  on public.compression_history for delete
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- user_settings (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_unit text not null default 'KB' check (default_unit in ('KB', 'MB')),
  default_output_format text not null default 'jpeg' check (default_output_format in ('jpeg', 'png', 'webp')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_settings enable row level security;

drop policy if exists "User settings are viewable by owner" on public.user_settings;
create policy "User settings are viewable by owner"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "User settings are insertable by owner" on public.user_settings;
create policy "User settings are insertable by owner"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "User settings are updatable by owner" on public.user_settings;
create policy "User settings are updatable by owner"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Auth signup → create profile + default settings
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for existing auth users (safe to re-run)
insert into public.profiles (id, full_name)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), '')
from auth.users as u
where not exists (
  select 1 from public.profiles as p where p.id = u.id
);

insert into public.user_settings (user_id)
select u.id
from auth.users as u
where not exists (
  select 1 from public.user_settings as s where s.user_id = u.id
);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.compression_history to authenticated;
grant select, insert, update on public.user_settings to authenticated;

grant all on public.profiles to service_role;
grant all on public.compression_history to service_role;
grant all on public.user_settings to service_role;
