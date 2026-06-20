create extension if not exists vector;

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null check (team in ('sales', 'operations', 'finance', 'admin')),
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique,
  email text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists raw_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  external_id text not null unique,
  channel text not null check (channel in ('whatsapp', 'email', 'voice', 'manual')),
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  content text,
  media_url text,
  audio_url text,
  status text not null default 'pending' check (status in ('pending', 'noise', 'extracted', 'failed', 'review_needed')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  raw_message_id uuid references raw_messages(id),
  contact_id uuid references contacts(id),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  owner_id uuid references team_members(id),
  due_at timestamptz,
  source_url text,
  plan_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  escalation_level integer not null default 0,
  channel text not null check (channel in ('whatsapp', 'email', 'app')),
  message_draft text,
  status text not null default 'scheduled' check (status in ('scheduled', 'pending_approval', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists message_embeddings (
  id uuid primary key default gen_random_uuid(),
  raw_message_id uuid not null references raw_messages(id) on delete cascade,
  embedding vector(768),
  content_type text not null check (content_type in ('message', 'task', 'contact_note')),
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  raw_message_id uuid references raw_messages(id),
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  plan_json jsonb not null,
  outcome_json jsonb,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_raw_messages_contact_id on raw_messages(contact_id);
create index if not exists idx_raw_messages_status on raw_messages(status);
create index if not exists idx_tasks_owner_id on tasks(owner_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_contact_id on tasks(contact_id);
create index if not exists idx_follow_ups_task_id on follow_ups(task_id);
create index if not exists idx_follow_ups_scheduled_at on follow_ups(scheduled_at) where status = 'scheduled';
