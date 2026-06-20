-- Loop initial schema
-- Run this in Supabase SQL Editor

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

-- Runs table (AI execution log)
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

-- RLS policies: service_role bypasses RLS, so we just need anon policies for client-side reads
-- For this hackathon, we allow anonymous read access and rely on the service role for writes
create policy "anon read contacts" on contacts for select to anon using (true);
create policy "anon read team_members" on team_members for select to anon using (true);
create policy "anon read raw_messages" on raw_messages for select to anon using (true);
create policy "anon read tasks" on tasks for select to anon using (true);
create policy "anon read follow_ups" on follow_ups for select to anon using (true);
create policy "anon read runs" on runs for select to anon using (true);

-- Allow anon to update tasks (for the dashboard UI)
create policy "anon update tasks" on tasks for update to anon using (true) with check (true);

-- Seed team members
insert into team_members (id, name, team, email) values
  ('11111111-1111-1111-1111-111111111111', 'Sarah (Sales)', 'sales', 'sarah@loop.demo'),
  ('22222222-2222-2222-2222-222222222222', 'Omar (Ops)', 'operations', 'omar@loop.demo'),
  ('33333333-3333-3333-3333-333333333333', 'Fatima (Finance)', 'finance', 'fatima@loop.demo'),
  ('44444444-4444-4444-4444-444444444444', 'Ahmed (Admin)', 'admin', 'ahmed@loop.demo')
on conflict (id) do nothing;

-- Seed demo contacts
insert into contacts (id, name, phone, email, metadata) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ali Traders', '+923001234567', 'ali@example.com', '{"business": "furniture"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clinic Care', '+923007654321', 'clinic@example.com', '{"business": "healthcare"}')
on conflict (id) do nothing;
