-- =============================================================================
-- DEPRECATED / NO-OP
--
-- Older drafts used different column names on batch_history.
-- The canonical schema now lives entirely in 003_batch_history.sql.
--
-- If you previously created an older batch_history table, drop it and re-run 003:
--
--   drop table if exists public.batch_history cascade;
--   -- then run 003_batch_history.sql
--
-- This file remains so migration numbering stays stable.
-- =============================================================================

notify pgrst, 'reload schema';
