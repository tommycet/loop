-- Loop: Commitment Control Plane migration (idempotent, demo-safe)
-- Run this in the Supabase SQL editor for the existing demo project.

create extension if not exists "uuid-ossp";

-- Commitments table
create table if not exists commitments (
  id uuid primary key default uuid_generate_v4(),
  raw_message_id uuid references raw_messages(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  type text not null check (type in (
    'discount_offer',
    'delivery_promise',
    'payment_claim',
    'refund_request',
    'complaint',
    'quote_request',
    'follow_up',
    'internal_task'
  )),
  extracted_text text not null,
  normalized_obligation jsonb not null default '{}'::jsonb,
  risk_tier text not null default 'medium' check (risk_tier in ('low','medium','high','blocked')),
  status text not null default 'detected' check (status in (
    'detected',
    'needs_approval',
    'approved',
    'rejected',
    'executed',
    'stale',
    'escalated',
    'closed'
  )),
  owner_id uuid references team_members(id) on delete set null,
  required_role text check (required_role in ('sales','operations','finance','admin')),
  due_at timestamptz,
  confidence numeric(3,2) default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commitments_status on commitments(status);
create index if not exists idx_commitments_risk_tier on commitments(risk_tier);
create index if not exists idx_commitments_required_role on commitments(required_role);
create index if not exists idx_commitments_contact_id on commitments(contact_id);
create index if not exists idx_commitments_due_at on commitments(due_at);

-- Approval requests table
create table if not exists approval_requests (
  id uuid primary key default uuid_generate_v4(),
  commitment_id uuid not null references commitments(id) on delete cascade,
  required_role text not null check (required_role in ('sales','operations','finance','admin')),
  approver_id uuid references team_members(id) on delete set null,
  proposed_action jsonb not null default '{}'::jsonb,
  edited_action jsonb,
  decision text not null default 'pending' check (decision in ('pending','approved','edited','rejected','expired')),
  decision_reason text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_approvals_commitment_id on approval_requests(commitment_id);
create index if not exists idx_approvals_decision on approval_requests(decision);
create index if not exists idx_approvals_required_role on approval_requests(required_role);

-- Audit events table
create table if not exists audit_events (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('commitment','approval','follow_up','task','message')),
  entity_id uuid not null,
  event_type text not null,
  actor_type text not null check (actor_type in ('ai','human','system')),
  actor_id uuid references team_members(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_events(entity_type, entity_id);
create index if not exists idx_audit_event_type on audit_events(event_type);
create index if not exists idx_audit_created_at on audit_events(created_at desc);

-- Authority rules table
create table if not exists authority_rules (
  id uuid primary key default uuid_generate_v4(),
  action_type text not null,
  required_role text not null check (required_role in ('sales','operations','finance','admin')),
  max_auto_threshold_pct numeric(5,2),
  max_auto_threshold_hours integer,
  fail_mode text not null default 'block' check (fail_mode in ('draft_only','block','escalate')),
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_authority_rules_action_type on authority_rules(action_type);

-- RLS
alter table commitments enable row level security;
alter table approval_requests enable row level security;
alter table audit_events enable row level security;
alter table authority_rules enable row level security;

create policy "anon read commitments" on commitments for select to anon using (true);
create policy "anon read approvals" on approval_requests for select to anon using (true);
create policy "anon read audit" on audit_events for select to anon using (true);
create policy "anon read authority_rules" on authority_rules for select to anon using (true);
create policy "anon insert commitments" on commitments for insert to anon with check (true);
create policy "anon update commitments" on commitments for update to anon using (true) with check (true);
create policy "anon insert approvals" on approval_requests for insert to anon with check (true);
create policy "anon update approvals" on approval_requests for update to anon using (true) with check (true);
create policy "anon insert audit" on audit_events for insert to anon with check (true);

-- Seed authority rules (idempotent)
insert into authority_rules (id, action_type, required_role, max_auto_threshold_pct, max_auto_threshold_hours, fail_mode, description)
values
  ('11111111-1111-1111-1111-111111111101', 'discount_offer', 'admin', 5, null, 'block', 'Discounts above 5% require admin sign-off.'),
  ('11111111-1111-1111-1111-111111111102', 'refund_request', 'finance', 0, null, 'block', 'All refunds require finance verification.'),
  ('11111111-1111-1111-1111-111111111103', 'delivery_promise', 'operations', null, 24, 'draft_only', 'Delivery commitments beyond 24h require ops approval.'),
  ('11111111-1111-1111-1111-111111111104', 'payment_claim', 'finance', null, 0, 'block', 'Payment claims require finance verification before acknowledgement.'),
  ('11111111-1111-1111-1111-111111111105', 'complaint', 'admin', null, 0, 'escalate', 'Repeat complaints escalate to admin.'),
  ('11111111-1111-1111-1111-111111111106', 'quote_request', 'sales', null, null, 'draft_only', 'Quote requests go to sales for ownership.'),
  ('11111111-1111-1111-1111-111111111107', 'follow_up', 'sales', null, null, 'draft_only', 'Follow-up assignments default to sales.')
on conflict (action_type) do nothing;