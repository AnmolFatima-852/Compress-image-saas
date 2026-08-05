-- =============================================================================
-- Batch compression history
-- Run this THIRD in the Supabase SQL Editor (after 001 and 002).
--
-- ZIP/PDF files live in the private `compression-outputs` bucket at:
--   {user_id}/batches/{batch_id}.zip
--   {user_id}/batches/{batch_id}.pdf
--
-- Safe / idempotent: creates the table if missing and (re)applies RLS.
-- =============================================================================

create table if not exists public.batch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_count integer not null check (image_count > 0),
  total_original_size bigint not null check (total_original_size >= 0),
  total_compressed_size bigint not null check (total_compressed_size >= 0),
  total_saved_space bigint not null default 0 check (total_saved_space >= 0),
  output_format text not null default 'JPEG',
  zip_downloaded boolean not null default false,
  pdf_downloaded boolean not null default false,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists batch_history_user_id_created_at_idx
  on public.batch_history (user_id, created_at desc);

alter table public.batch_history enable row level security;

drop policy if exists "Batch history is viewable by owner" on public.batch_history;
create policy "Batch history is viewable by owner"
  on public.batch_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Batch history is insertable by owner" on public.batch_history;
create policy "Batch history is insertable by owner"
  on public.batch_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Batch history is updatable by owner" on public.batch_history;
create policy "Batch history is updatable by owner"
  on public.batch_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Batch history is deletable by owner" on public.batch_history;
create policy "Batch history is deletable by owner"
  on public.batch_history for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.batch_history to authenticated;
grant all on public.batch_history to service_role;

-- Refresh PostgREST schema cache so the API sees the new table immediately.
notify pgrst, 'reload schema';
