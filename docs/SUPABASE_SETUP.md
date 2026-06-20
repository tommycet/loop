# Supabase Schema Setup

## Quick Setup (3 minutes)

1. Go to: https://supabase.com/dashboard/project/skucqwqptusyyoxegqpk/editor
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy-paste the entire contents of `supabase/migrations/001_initial_schema.sql` into the editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for "Success. No rows returned"

That's it — your database is ready.

## What gets created

- **6 tables:** contacts, team_members, raw_messages, tasks, follow_ups, runs
- **Indexes** for fast queries
- **4 demo team members** (Sarah, Omar, Fatima, Ahmed)
- **Row Level Security** enabled (but bypassed by service_role key we're using)

## Verify it worked

After running the migration, go to **Table Editor** in the left sidebar.
You should see all 6 tables listed.

Click on `team_members` — you should see 4 rows.
