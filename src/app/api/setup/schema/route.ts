import { NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

const SCHEMA_SQL = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Contacts table
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  name text,
  phone text,
  email text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  constraint contacts_phone_unique unique (phone),
  constraint contacts_email_unique unique (email)
);

-- Team members table
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  team text not null check (team in ('sales', 'operations', 'finance', 'admin')),
  phone text,
  email text,
  created_at timestamptz default now()
);

-- Raw messages table
create table if not exists raw_messages (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid references contacts(id),
  external_id text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'voice', 'manual')),
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  media_url text,
  audio_url text,
  status text not null check (status in ('pending', 'noise', 'extracted', 'failed', 'review_needed')),
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  constraint raw_messages_external_id_unique unique (external_id)
);

-- Tasks table
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  raw_message_id uuid references raw_messages(id),
  contact_id uuid references contacts(id),
  title text not null,
  description text,
  status text not null check (status in ('open', 'in_progress', 'done', 'cancelled')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  owner_id uuid references team_members(id),
  due_at timestamptz,
  source_url text,
  plan_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Follow-ups table
create table if not exists follow_ups (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  escalation_level int not null default 1,
  channel text not null check (channel in ('whatsapp', 'email', 'app')),
  message_draft text,
  status text not null check (status in ('scheduled', 'pending_approval', 'sent', 'failed')),
  created_at timestamptz default now()
);

-- Runs table
create table if not exists runs (
  id uuid primary key default uuid_generate_v4(),
  raw_message_id uuid references raw_messages(id),
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  plan_json jsonb not null,
  outcome_json jsonb,
  latency_ms int,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_raw_messages_contact_id on raw_messages(contact_id);
create index if not exists idx_raw_messages_status on raw_messages(status);
create index if not exists idx_raw_messages_created_at on raw_messages(created_at desc);
create index if not exists idx_tasks_contact_id on tasks(contact_id);
create index if not exists idx_tasks_owner_id on tasks(owner_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_at on tasks(due_at);
create index if not exists idx_follow_ups_task_id on follow_ups(task_id);
create index if not exists idx_follow_ups_scheduled_at on follow_ups(scheduled_at);
create index if not exists idx_follow_ups_status on follow_ups(status);

-- Enable RLS
alter table contacts enable row level security;
alter table team_members enable row level security;
alter table raw_messages enable row level security;
alter table tasks enable row level security;
alter table follow_ups enable row level security;
alter table runs enable row level security;
`;

const SEED_SQL = `
-- Seed team members (only if empty)
insert into team_members (id, name, team, email)
select * from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Sarah (Sales)', 'sales', 'sarah@loop.demo'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Omar (Ops)', 'operations', 'omar@loop.demo'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Fatima (Finance)', 'finance', 'fatima@loop.demo'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'Ahmed (Admin)', 'admin', 'ahmed@loop.demo')
) as v(id, name, team, email)
where not exists (select 1 from team_members limit 1);
`;

export async function POST() {
  try {
    const supabase = getSupabase();
    
    // Execute schema
    const { error: schemaError } = await supabase.rpc("exec_sql", { sql: SCHEMA_SQL });
    
    if (schemaError && !schemaError.message?.includes("already exists")) {
      // Try alternative: execute via raw SQL (may not work on all Supabase tiers)
      console.error("Schema error:", schemaError);
      return NextResponse.json(
        {
          ok: false,
          error: "Schema creation failed. Please run the SQL manually in Supabase SQL Editor.",
          hint: "Go to: Supabase Dashboard → SQL Editor → paste supabase/migrations/001_initial_schema.sql",
          details: schemaError.message
        },
        { status: 500 }
      );
    }
    
    // Seed data
    const { error: seedError } = await supabase.rpc("exec_sql", { sql: SEED_SQL });
    if (seedError) {
      console.warn("Seed warning:", seedError);
    }
    
    return NextResponse.json({
      ok: true,
      message: "Schema created successfully",
      tables: ["contacts", "team_members", "raw_messages", "tasks", "follow_ups", "runs"]
    });
    
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: "Run the migration manually in Supabase SQL Editor if automatic setup fails"
      },
      { status: 500 }
    );
  }
}
