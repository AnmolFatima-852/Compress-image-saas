# Supabase migrations

Apply these in the **Supabase Dashboard → SQL Editor**, in order:

1. `001_profiles_and_compression_history.sql` — creates `profiles`, `compression_history`, `user_settings`, RLS, and the signup trigger
2. `002_storage_buckets_and_policies.sql` — creates storage buckets and storage RLS
3. `003_batch_history.sql` — creates `batch_history` (required for Dashboard Batch History)

`004_batch_history_output_format.sql` is a no-op kept for numbering; you can skip it.

## Required for Batch History

If the app logs `Could not find the table 'public.batch_history' (PGRST205)`, open the SQL Editor and run **all of** `003_batch_history.sql`, then wait a few seconds (or reload the Supabase project) so PostgREST picks up the table.

All files are idempotent and safe to re-run.
