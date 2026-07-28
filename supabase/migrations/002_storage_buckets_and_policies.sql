-- Storage buckets for avatars and compressed file downloads (Dashboard).
insert into storage.buckets (id, name, public)
values
  ('compression-outputs', 'compression-outputs', false),
  ('avatars', 'avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

-- compression-outputs
drop policy if exists "Users can upload own compression outputs" on storage.objects;
create policy "Users can upload own compression outputs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'compression-outputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own compression outputs" on storage.objects;
create policy "Users can read own compression outputs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compression-outputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own compression outputs" on storage.objects;
create policy "Users can update own compression outputs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'compression-outputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own compression outputs" on storage.objects;
create policy "Users can delete own compression outputs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'compression-outputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- avatars
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
