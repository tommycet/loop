-- Migration 003: extend raw_messages.channel to include 'telegram' and 'slack'
-- The original 001_initial_schema.sql only allowed ('whatsapp', 'email', 'voice', 'manual').
-- The codebase has shipped telegram.ts + slack.ts channels since then, so the
-- CHECK constraint needs to be relaxed.
--
-- Apply this in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/skucqwqptusyyoxegqpk/sql/new
--
-- Idempotent: safe to run multiple times.

-- Drop the old constraint (it has a fixed name from the original migration).
ALTER TABLE public.raw_messages
  DROP CONSTRAINT IF EXISTS raw_messages_channel_check;

-- Re-add with the full channel set.
ALTER TABLE public.raw_messages
  ADD CONSTRAINT raw_messages_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'voice', 'manual', 'telegram', 'slack'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.raw_messages'::regclass
  AND contype = 'c'
  AND conname = 'raw_messages_channel_check';
