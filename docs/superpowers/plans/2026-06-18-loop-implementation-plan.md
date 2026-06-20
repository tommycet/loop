# Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Loop, an AI operations agent that ingests WhatsApp/email/voice messages, reasons over operational memory via an LLM planner, creates tasks, assigns owners, and chases open loops until they close.

**Architecture:** Next.js 14 + Supabase (Postgres/Realtime/Storage) + Inngest (workflows/cron) + Groq (transcription + LLM) + OpenRouter (fallback LLM), deployed on Vercel. Single hardcoded demo org, no auth/RLS in MVP.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Inngest, Groq SDK, OpenAI SDK (for OpenRouter), Twilio, Resend.

## Global Constraints

- **Single demo org:** no multi-tenancy, no auth, no RLS.
- **Free-tier deployment:** Vercel Hobby, Supabase free, Inngest free, Groq free, OpenRouter free fallback.
- **Agentic core:** planner emits tool calls with local refs; executor resolves refs to UUIDs.
- **Approval-only outbound:** no auto-reply to customers by default.
- **Demo mode:** `DEMO_MODE=true` shortens debounce to 2–3 seconds.
- **No placeholders:** every step must include code, commands, and expected outputs.

---

## File Structure

```
loop/
├── src/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── inngest.ts
│   │   ├── groq.ts
│   │   ├── openrouter.ts
│   │   ├── utils.ts
│   │   ├── contacts.ts
│   │   ├── classifier.ts
│   │   ├── transcribe.ts
│   │   ├── tools.ts
│   │   ├── planner.ts
│   │   └── agent.ts
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── whatsapp/route.ts
│   │   │   │   └── email/route.ts
│   │   │   ├── inngest/route.ts
│   │   │   ├── messages/route.ts
│   │   │   ├── tasks/
│   │   │   │   └── route.ts
│   │   │   ├── contacts/
│   │   │   │   └── route.ts
│   │   │   ├── dashboard/route.ts
│   │   │   └── approvals/route.ts
│   │   ├── page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── approvals/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── MessageFeed.tsx
│   │   ├── TaskBoard.tsx
│   │   ├── TaskCard.tsx
│   │   ├── ApprovalQueue.tsx
│   │   ├── DashboardStats.tsx
│   │   └── RealtimeProvider.tsx
│   └── types/
│       └── index.ts
├── supabase/
│   ├── migrations/0001_initial.sql
│   └── seed.sql
├── tests/
│   ├── contacts.test.ts
│   ├── classifier.test.ts
│   ├── planner.test.ts
│   └── tools.test.ts
├── .env.local
├── vitest.config.ts
├── package.json
└── next.config.js
```

---

## Task 1: Project Scaffold and Dependencies

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `.env.local` (template)
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: none
- Produces: runnable Next.js project with test runner

- [ ] **Step 1: Initialize project**

```bash
cd /root/loop
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
```

Expected: project scaffold created.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js
npm install inngest
npm install groq-sdk
npm install openai
npm install twilio
npm install resend
npm install lucide-react clsx tailwind-merge class-variance-authority
npx shadcn-ui@latest init -y
npx shadcn-ui@latest add button card badge dialog tabs input textarea select sheet
npm install -D vitest @vitejs/plugin-react dotenv
```

- [ ] **Step 3: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:run": "vitest run",
    "inngest": "npx inngest-cli@latest dev"
  }
}
```

- [ ] **Step 4: Create `.env.local` template**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_MODE=false

GROQ_API_KEY=
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
GROQ_CLASSIFIER_MODEL=llama-3.1-8b-instant
GROQ_PLANNER_MODEL=llama-3.3-70b-versatile

OPENROUTER_API_KEY=
OPENROUTER_FALLBACK_MODEL=qwen/qwen-2.5-72b-instruct

INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_WEBHOOK_SECRET=
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

## Task 2: Supabase Schema, Seed, and Types

**Files:**
- Create: `supabase/migrations/0001_initial.sql`
- Create: `supabase/seed.sql`
- Create: `src/types/index.ts`

**Interfaces:**
- Consumes: none
- Produces: database tables, seed data, TypeScript types

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/0001_initial.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('sales', 'operations', 'finance', 'admin')),
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  external_id TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'voice', 'manual')),
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  media_url TEXT,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'noise', 'extracted', 'failed', 'review_needed')),
  raw_payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_message_id UUID REFERENCES raw_messages(id),
  contact_id UUID REFERENCES contacts(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  owner_id UUID REFERENCES team_members(id),
  due_at TIMESTAMPTZ,
  source_url TEXT,
  plan_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  escalation_level INT DEFAULT 0,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'app')),
  message_draft TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending_approval', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE message_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_message_id UUID REFERENCES raw_messages(id) ON DELETE CASCADE,
  embedding VECTOR(768),
  content_type TEXT NOT NULL CHECK (content_type IN ('message', 'task', 'contact_note')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_message_id UUID REFERENCES raw_messages(id),
  model TEXT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  plan_json JSONB NOT NULL,
  outcome_json JSONB,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_raw_messages_contact_id ON raw_messages(contact_id);
CREATE INDEX idx_raw_messages_status ON raw_messages(status);
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX idx_follow_ups_task_id ON follow_ups(task_id);
CREATE INDEX idx_follow_ups_scheduled_at ON follow_ups(scheduled_at) WHERE status = 'scheduled';
```

- [ ] **Step 2: Write seed data**

```sql
-- supabase/seed.sql
INSERT INTO team_members (id, name, team, phone, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ahmed Sales', 'sales', '+923000000001', 'ahmed@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Fatima Ops', 'operations', '+923000000002', 'fatima@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'Omar Finance', 'finance', '+923000000003', 'omar@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'Sara Admin', 'admin', '+923000000004', 'sara@example.com');

INSERT INTO contacts (id, name, phone, email, metadata) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ali Traders', '+923000000005', 'ali@example.com', '{"business": "furniture"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clinic Care', '+923000000006', 'clinic@example.com', '{"business": "healthcare"}');

INSERT INTO raw_messages (id, contact_id, external_id, channel, direction, content, status) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-msg-1', 'whatsapp', 'inbound', 'Need a quote for 20 office chairs by Friday, delivery to DHA.', 'extracted');

INSERT INTO tasks (id, raw_message_id, contact_id, title, status, priority, owner_id, due_at) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Prepare quote for 20 office chairs', 'open', 'high', '11111111-1111-1111-1111-111111111111', now() + interval '4 hours');
```

- [ ] **Step 3: Create TypeScript types**

```ts
// src/types/index.ts
export type Team = 'sales' | 'operations' | 'finance' | 'admin';
export type Channel = 'whatsapp' | 'email' | 'voice' | 'manual';
export type Direction = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'noise' | 'extracted' | 'failed' | 'review_needed';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type FollowUpStatus = 'scheduled' | 'pending_approval' | 'sent' | 'failed';

export interface TeamMember {
  id: string;
  name: string;
  team: Team;
  phone?: string;
  email?: string;
  created_at: string;
}

export interface Contact {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface RawMessage {
  id: string;
  contact_id?: string;
  external_id: string;
  channel: Channel;
  direction: Direction;
  content?: string;
  media_url?: string;
  audio_url?: string;
  status: MessageStatus;
  raw_payload: Record<string, any>;
  created_at: string;
}

export interface Task {
  id: string;
  raw_message_id?: string;
  contact_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  owner_id?: string;
  due_at?: string;
  source_url?: string;
  plan_snapshot: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  task_id: string;
  scheduled_at: string;
  sent_at?: string;
  escalation_level: number;
  channel: Channel;
  message_draft?: string;
  status: FollowUpStatus;
  created_at: string;
}

export type ToolName =
  | 'create_task'
  | 'assign_owner'
  | 'schedule_followup'
  | 'draft_message'
  | 'escalate'
  | 'link_to_contact'
  | 'ignore'
  | 'ask_human';

export interface ToolCall {
  ref?: string;
  tool: ToolName;
  args: Record<string, any>;
}

export interface Run {
  id: string;
  raw_message_id?: string;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  plan_json: ToolCall[];
  outcome_json?: Record<string, any>;
  latency_ms?: number;
  created_at: string;
}
```

- [ ] **Step 4: Apply migrations and seed in Supabase Dashboard**

Navigate to Supabase → SQL Editor, run `0001_initial.sql`, then run `seed.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/ src/types/
git commit -m "feat: add database schema, seed data, and types"
```

---

## Task 3: Shared Clients and Helpers

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/inngest.ts`
- Create: `src/lib/groq.ts`
- Create: `src/lib/openrouter.ts`
- Create: `src/lib/utils.ts`

**Interfaces:**
- Consumes: environment variables
- Produces: configured clients and helper functions

- [ ] **Step 1: Create client files**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabase = createClient(url, serviceKey);
```

```ts
// src/lib/inngest.ts
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'loop-agent' });
```

```ts
// src/lib/groq.ts
import Groq from 'groq-sdk';
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
```

```ts
// src/lib/openrouter.ts
import OpenAI from 'openai';
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
    'X-Title': 'Loop Agent',
  },
});
```

```ts
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.ts src/lib/inngest.ts src/lib/groq.ts src/lib/openrouter.ts src/lib/utils.ts
git commit -m "chore: add shared clients and helpers"
```

---

## Task 4: Contact Upsert

**Files:**
- Create: `src/lib/contacts.ts`
- Test: `tests/contacts.test.ts`

**Interfaces:**
- Consumes: Supabase client
- Produces: `upsertContactByPhone`, `upsertContactByEmail`

- [ ] **Step 1: Implement upsert functions**

```ts
// src/lib/contacts.ts
import { supabase } from './supabase';
import { Contact } from '@/types';

export async function upsertContactByPhone(
  phone: string,
  name?: string,
  metadata?: Record<string, any>
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      { phone, name: name || null, metadata: metadata || {} },
      { onConflict: 'phone' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function upsertContactByEmail(
  email: string,
  name?: string,
  metadata?: Record<string, any>
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      { email, name: name || null, metadata: metadata || {} },
      { onConflict: 'email' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}
```

- [ ] **Step 2: Write tests**

```ts
// tests/contacts.test.ts
import { describe, it, expect } from 'vitest';
import { upsertContactByPhone, upsertContactByEmail } from '@/lib/contacts';

describe('contacts', () => {
  it('upserts by phone without duplicates', async () => {
    const c1 = await upsertContactByPhone('+923000999000', 'Test');
    const c2 = await upsertContactByPhone('+923000999000', 'Updated');
    expect(c1.id).toBe(c2.id);
  });

  it('upserts by email without duplicates', async () => {
    const c1 = await upsertContactByEmail('upsert@example.com', 'Test');
    const c2 = await upsertContactByEmail('upsert@example.com', 'Updated');
    expect(c1.id).toBe(c2.id);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run tests/contacts.test.ts
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/contacts.ts tests/contacts.test.ts
git commit -m "feat: add contact upsert with tests"
```

---

## Task 5: Ingestion Webhooks

**Files:**
- Create: `src/app/api/webhooks/whatsapp/route.ts`
- Create: `src/app/api/webhooks/email/route.ts`

**Interfaces:**
- Consumes: Twilio, Resend, contact upsert
- Produces: `raw_messages` rows + `message.received` Inngest events

- [ ] **Step 1: Implement WhatsApp webhook**

```ts
// src/app/api/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { upsertContactByPhone } from '@/lib/contacts';

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const signature = req.headers.get('x-twilio-signature') || '';
  const url = req.url;
  const formData = await req.formData();
  const payload = Object.fromEntries(formData.entries());

  const isValid = twilio.validateRequest(authToken, signature, url, payload as any);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const from = (payload.From as string).replace('whatsapp:', '');
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;
  const direction = from === twilioNumber ? 'outbound' : 'inbound';

  const contact = await upsertContactByPhone(from, payload.ProfileName as string);

  const { data: message, error } = await supabase
    .from('raw_messages')
    .insert({
      contact_id: contact.id,
      external_id: payload.MessageSid as string,
      channel: 'whatsapp',
      direction,
      content: payload.Body as string,
      status: direction === 'outbound' ? 'extracted' : 'pending',
      raw_payload: payload,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (direction === 'inbound') {
    await inngest.send({
      name: 'message.received',
      data: { messageId: message.id, contactId: contact.id, channel: 'whatsapp' },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Implement email webhook**

```ts
// src/app/api/webhooks/email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { upsertContactByEmail } from '@/lib/contacts';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const signature = req.headers.get('resend-signature') || '';

  if (signature !== process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const email = Array.isArray(payload.from) ? payload.from[0] : payload.from;
  const contact = await upsertContactByEmail(email, payload.from_name);

  const { data: message, error } = await supabase
    .from('raw_messages')
    .insert({
      contact_id: contact.id,
      external_id: payload.message_id || `email-${Date.now()}`,
      channel: 'email',
      direction: 'inbound',
      content: payload.text || payload.html,
      status: 'pending',
      raw_payload: payload,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await inngest.send({
    name: 'message.received',
    data: { messageId: message.id, contactId: contact.id, channel: 'email' },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat: add WhatsApp and email ingestion webhooks"
```

---

## Task 6: Pre-Classifier and Debounce

**Files:**
- Create: `src/lib/classifier.ts`
- Create: `src/lib/inngest/functions/classify-and-debounce.ts`
- Create: `src/lib/inngest/functions/index.ts`
- Create: `src/app/api/inngest/route.ts`
- Test: `tests/classifier.test.ts`

**Interfaces:**
- Consumes: `message.received` event
- Produces: `message.batch_ready` event or `noise` status update

- [ ] **Step 1: Implement pre-classifier**

```ts
// src/lib/classifier.ts
import { groq } from './groq';

const NOISE_WORDS = new Set([
  'ok', 'thanks', 'thank you', 'done', 'got it', 'will do', 'noted',
  '👍', '👌', '✓', '✔', 'yes', 'no'
]);

const ACTION_WORDS = [
  'send', 'quote', 'check', 'call', 'pay', 'book', 'confirm', 'deliver',
  'follow up', 'prepare', 'order', 'ship', 'invoice', 'remind', 'schedule', 'buy'
];

export function isNoise(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return normalized.length === 0 || NOISE_WORDS.has(normalized);
}

export function hasActionSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return ACTION_WORDS.some(word => normalized.includes(word));
}

export async function classifyMessage(text: string): Promise<'noise' | 'task' | 'unclear'> {
  if (isNoise(text)) return 'noise';
  if (hasActionSignal(text)) return 'task';

  const prompt = `Classify this business message as exactly one word: noise, task, unclear.

Message: "${text}"

noise = greetings, acknowledgments, emojis, small talk
task = contains a request, commitment, or next action
unclear = ambiguous

Answer with one word only.`;

  const response = await groq.chat.completions.create({
    model: process.env.GROQ_CLASSIFIER_MODEL || 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 10,
  });

  const result = response.choices[0].message.content?.trim().toLowerCase() || 'unclear';
  if (result.includes('noise')) return 'noise';
  if (result.includes('task')) return 'task';
  return 'unclear';
}
```

- [ ] **Step 2: Implement Inngest classify-and-debounce function**

```ts
// src/lib/inngest/functions/classify-and-debounce.ts
import { inngest } from '@/lib/inngest';
import { supabase } from '@/lib/supabase';
import { classifyMessage } from '@/lib/classifier';
import { isDemoMode } from '@/lib/utils';

export const classifyAndDebounce = inngest.createFunction(
  {
    id: 'classify-and-debounce',
    debounce: {
      key: 'event.data.contactId',
      period: isDemoMode() ? '3s' : '30s',
      timeout: isDemoMode() ? '5s' : '60s',
    },
  },
  { event: 'message.received' },
  async ({ event, step }) => {
    const messageId = event.data.messageId as string;
    const contactId = event.data.contactId as string;

    const { data: message } = await supabase
      .from('raw_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) throw new Error('Message not found');

    const classification = await step.run('classify', async () => {
      return classifyMessage(message.content || '');
    });

    if (classification === 'noise') {
      await supabase.from('raw_messages').update({ status: 'noise' }).eq('id', messageId);
      return { status: 'noise' };
    }

    const { data: pendingMessages } = await supabase
      .from('raw_messages')
      .select('id')
      .eq('contact_id', contactId)
      .eq('status', 'pending')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: true });

    const messageIds = pendingMessages?.map(m => m.id) || [messageId];

    await inngest.send({
      name: 'message.batch_ready',
      data: { messageIds, contactId },
    });

    return { status: 'batched', count: messageIds.length };
  }
);
```

- [ ] **Step 3: Register functions and Inngest route**

```ts
// src/lib/inngest/functions/index.ts
export { classifyAndDebounce } from './classify-and-debounce';
```

```ts
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { classifyAndDebounce } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [classifyAndDebounce],
});
```

- [ ] **Step 4: Write tests**

```ts
// tests/classifier.test.ts
import { describe, it, expect } from 'vitest';
import { isNoise, hasActionSignal } from '@/lib/classifier';

describe('classifier', () => {
  it('marks acknowledgments as noise', () => {
    expect(isNoise('ok')).toBe(true);
    expect(isNoise('thanks')).toBe(true);
    expect(isNoise('👍')).toBe(true);
  });

  it('detects action signals', () => {
    expect(hasActionSignal('send the quote by Friday')).toBe(true);
    expect(hasActionSignal('got it')).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:run tests/classifier.test.ts
git add src/lib/classifier.ts src/lib/inngest/ src/app/api/inngest/route.ts tests/classifier.test.ts
git commit -m "feat: add pre-classifier and debounce workflow"
```

---

## Task 7: Transcription

**Files:**
- Create: `src/lib/transcribe.ts`

**Interfaces:**
- Consumes: audio URL in Supabase Storage
- Produces: transcribed text

- [ ] **Step 1: Implement transcription**

```ts
// src/lib/transcribe.ts
import { groq } from './groq';
import { supabase } from './supabase';

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const path = audioUrl.replace(/^.*\//, '');
  const { data: blob, error } = await supabase.storage.from('audio-messages').download(path);
  if (error || !blob) throw new Error(`Download failed: ${error?.message}`);

  const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3',
    response_format: 'text',
  });

  return transcription as unknown as string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/transcribe.ts
git commit -m "feat: add Groq Whisper transcription"
```

---

## Task 8: Agent Tool Executor

**Files:**
- Create: `src/lib/tools.ts`
- Test: `tests/tools.test.ts`

**Interfaces:**
- Consumes: Supabase tables
- Produces: deterministic tool implementations

- [ ] **Step 1: Implement tool handlers**

```ts
// src/lib/tools.ts
import { supabase } from './supabase';
import { ToolName, Team } from '@/types';
import { addHours } from './utils';

export interface ToolContext {
  messageId?: string;
  contactId?: string;
  teamMembers: { id: string; name: string; team: Team }[];
}

export interface ToolResult {
  id?: string;
  success: boolean;
  error?: string;
}

const handlers: Record<ToolName, (args: any, ctx: ToolContext) => Promise<ToolResult>> = {
  async link_to_contact(args) {
    const { phone, email, name } = args;
    let data, error;
    if (phone) {
      ({ data, error } = await supabase.from('contacts').upsert({ phone, name }, { onConflict: 'phone' }).select().single());
    } else if (email) {
      ({ data, error } = await supabase.from('contacts').upsert({ email, name }, { onConflict: 'email' }).select().single());
    } else {
      return { success: false, error: 'phone or email required' };
    }
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  async create_task(args, ctx) {
    const { title, description, priority, due_in_hours } = args;
    const dueAt = due_in_hours ? addHours(new Date(), due_in_hours).toISOString() : undefined;
    const { data, error } = await supabase.from('tasks').insert({
      raw_message_id: ctx.messageId,
      contact_id: ctx.contactId,
      title,
      description,
      priority: priority || 'medium',
      due_at: dueAt,
      plan_snapshot: args,
    }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  async assign_owner(args, ctx) {
    const { task_id, team } = args;
    const candidates = ctx.teamMembers.filter(m => m.team === team);
    if (candidates.length === 0) return { success: false, error: `no ${team} member` };

    const { data: counts } = await supabase.rpc('get_open_task_counts', {
      member_ids: candidates.map(c => c.id)
    });

    const countMap = new Map((counts || []).map((c: any) => [c.owner_id, Number(c.count)]));
    const owner = candidates.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0))[0];

    const { error } = await supabase.from('tasks').update({ owner_id: owner.id }).eq('id', task_id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async schedule_followup(args) {
    const { task_id, in_hours, escalation_level, message_draft } = args;
    const { data, error } = await supabase.from('follow_ups').insert({
      task_id,
      scheduled_at: addHours(new Date(), in_hours || 2).toISOString(),
      escalation_level: escalation_level || 0,
      channel: 'app',
      message_draft: message_draft || '',
    }).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  async draft_message(args) {
    // Approval queue will surface this later
    return { success: true, id: args.task_id };
  },

  async escalate(args) {
    return handlers.schedule_followup({ ...args, escalation_level: 1 }, {} as any);
  },

  async ignore() {
    return { success: true };
  },

  async ask_human() {
    return { success: true };
  },
};

export async function executeTool(
  tool: ToolName,
  args: Record<string, any>,
  ctx: ToolContext
): Promise<ToolResult> {
  const handler = handlers[tool];
  if (!handler) return { success: false, error: `unknown tool: ${tool}` };
  return handler(args, ctx);
}
```

Note: add a Supabase function `get_open_task_counts` or compute counts client-side in the RPC call.

- [ ] **Step 2: Commit**

```bash
git add src/lib/tools.ts tests/tools.test.ts
git commit -m "feat: add agent tool executor"
```

---

## Task 9: LLM Planner and Ref Resolution

**Files:**
- Create: `src/lib/planner.ts`
- Test: `tests/planner.test.ts`

**Interfaces:**
- Consumes: message batch, contact, recent messages, open tasks, team members
- Produces: array of `ToolCall`

- [ ] **Step 1: Implement planner**

```ts
// src/lib/planner.ts
import { groq } from './groq';
import { openrouter } from './openrouter';
import { ToolCall } from '@/types';

export interface PlannerInput {
  messageBatch: { content?: string }[];
  contact?: { name?: string; phone?: string; email?: string };
  recentMessages: { content?: string }[];
  openTasks: { title: string; status: string }[];
  teamMembers: { name: string; team: string }[];
}

export async function planActions(input: PlannerInput): Promise<ToolCall[]> {
  const prompt = buildPlannerPrompt(input);
  const model = process.env.GROQ_PLANNER_MODEL || 'llama-3.3-70b-versatile';

  try {
    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    return parsePlan(response.choices[0].message.content || '{}');
  } catch (err) {
    const fallback = process.env.OPENROUTER_FALLBACK_MODEL || 'qwen/qwen-2.5-72b-instruct';
    const response = await openrouter.chat.completions.create({
      model: fallback,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    return parsePlan(response.choices[0].message.content || '{}');
  }
}

function buildPlannerPrompt(input: PlannerInput): string {
  return `You are Loop, an AI operations agent for a small team.

Current messages:
${input.messageBatch.map(m => `- ${m.content || '[audio]'}`).join('\n')}

Contact: ${input.contact?.name || 'Unknown'}

Recent context:
${input.recentMessages.map(m => `- ${m.content}`).join('\n') || 'None'}

Open tasks:
${input.openTasks.map(t => `- [${t.status}] ${t.title}`).join('\n') || 'None'}

Team:
${input.teamMembers.map(m => `- ${m.name} (${m.team})`).join('\n')}

Available tools: link_to_contact, create_task, assign_owner, schedule_followup, draft_message, escalate, ignore, ask_human.

Rules:
- Only create tasks for concrete actions, not acknowledgments.
- Avoid duplicate tasks for the same commitment.
- Use refs for cross-tool references. Example: create_task with ref "task_1", then assign_owner with args { "task_ref": "task_1" }.
- If confidence is low, use ask_human.

Return JSON: { "plan": [{ "ref": "...", "tool": "...", "args": {} }] }`;
}

function parsePlan(content: string): ToolCall[] {
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.plan) ? parsed.plan : [];
}

export function resolveRefs(call: ToolCall, refs: Map<string, string>): ToolCall {
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(call.args)) {
    if (key.endsWith('_ref') && typeof value === 'string') {
      const uuid = refs.get(value);
      if (!uuid) throw new Error(`Unresolved ref: ${value}`);
      resolved[key.replace('_ref', '_id')] = uuid;
    } else {
      resolved[key] = value;
    }
  }
  return { ...call, args: resolved };
}

export async function executePlan(
  plan: ToolCall[],
  ctx: any
): Promise<{ results: any[]; refs: Map<string, string> }> {
  const refs = new Map<string, string>();
  const results = [];
  for (const call of plan) {
    const resolved = resolveRefs(call, refs);
    const result = await executeTool(resolved.tool, resolved.args, ctx);
    if (call.ref && result.id) refs.set(call.ref, result.id);
    results.push(result);
  }
  return { results, refs };
}
```

Note: import `executeTool` from `./tools` in the actual file.

- [ ] **Step 2: Write ref resolution tests**

```ts
// tests/planner.test.ts
import { describe, it, expect } from 'vitest';
import { resolveRefs } from '@/lib/planner';

describe('planner refs', () => {
  it('resolves task_ref to task_id', () => {
    const refs = new Map([['task_1', 'uuid-123']]);
    const call = { tool: 'assign_owner' as const, args: { task_ref: 'task_1', team: 'sales' } };
    const resolved = resolveRefs(call, refs);
    expect(resolved.args).toEqual({ task_id: 'uuid-123', team: 'sales' });
  });

  it('throws on unresolved ref', () => {
    const call = { tool: 'assign_owner' as const, args: { task_ref: 'missing', team: 'sales' } };
    expect(() => resolveRefs(call, new Map())).toThrow('Unresolved ref');
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npm run test:run tests/planner.test.ts
git add src/lib/planner.ts tests/planner.test.ts
git commit -m "feat: add LLM planner with ref resolution"
```

---

## Task 10: Handle Message Batch (Agent Orchestration)

**Files:**
- Create: `src/lib/inngest/functions/handle-batch.ts`
- Modify: `src/lib/inngest/functions/index.ts`

**Interfaces:**
- Consumes: `message.batch_ready` event
- Produces: tasks, follow-ups, `runs` records

- [ ] **Step 1: Implement handle-batch function**

```ts
// src/lib/inngest/functions/handle-batch.ts
import { inngest } from '@/lib/inngest';
import { supabase } from '@/lib/supabase';
import { transcribeAudio } from '@/lib/transcribe';
import { planActions, executePlan } from '@/lib/planner';
import { executeTool } from '@/lib/tools';

export const handleBatch = inngest.createFunction(
  { id: 'handle-message-batch' },
  { event: 'message.batch_ready' },
  async ({ event, step }) => {
    const { messageIds, contactId } = event.data as { messageIds: string[]; contactId: string };

    const { data: messages } = await supabase
      .from('raw_messages')
      .select('*')
      .in('id', messageIds)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) return;

    // Transcribe audio
    for (const msg of messages) {
      if (msg.audio_url && !msg.content) {
        const text = await step.run(`transcribe-${msg.id}`, () => transcribeAudio(msg.audio_url!));
        await supabase.from('raw_messages').update({ content: text }).eq('id', msg.id);
        msg.content = text;
      }
    }

    const { data: contact } = await supabase.from('contacts').select('*').eq('id', contactId).single();
    const { data: recentMessages } = await supabase
      .from('raw_messages')
      .select('content, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: openTasks } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('contact_id', contactId)
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: teamMembers } = await supabase.from('team_members').select('*');

    const start = Date.now();
    const plan = await step.run('plan', () =>
      planActions({
        messageBatch: messages.map(m => ({ content: m.content })),
        contact,
        recentMessages: recentMessages || [],
        openTasks: openTasks || [],
        teamMembers: teamMembers || [],
      })
    );

    const { results } = await executePlan(plan, {
      messageId: messages[0].id,
      contactId,
      teamMembers: teamMembers || [],
    });

    await supabase.from('runs').insert({
      raw_message_id: messages[0].id,
      model: process.env.GROQ_PLANNER_MODEL || 'llama-3.3-70b-versatile',
      plan_json: plan,
      outcome_json: { results },
      latency_ms: Date.now() - start,
    });

    await supabase.from('raw_messages').update({ status: 'extracted' }).in('id', messageIds);

    return { plan, results };
  }
);
```

- [ ] **Step 2: Register function**

```ts
// src/lib/inngest/functions/index.ts
export { classifyAndDebounce } from './classify-and-debounce';
export { handleBatch } from './handle-batch';
```

```ts
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { classifyAndDebounce, handleBatch } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [classifyAndDebounce, handleBatch],
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/inngest/functions/handle-batch.ts src/lib/inngest/functions/index.ts src/app/api/inngest/route.ts
git commit -m "feat: add agent batch handler orchestrating planner + executor"
```

---

## Task 11: Follow-Up Engine

**Files:**
- Create: `src/lib/inngest/functions/follow-ups.ts`
- Modify: `src/lib/inngest/functions/index.ts`

**Interfaces:**
- Consumes: `task.created`, cron schedule
- Produces: scheduled follow-ups, escalations

- [ ] **Step 1: Implement follow-up functions**

```ts
// src/lib/inngest/functions/follow-ups.ts
import { inngest } from '@/lib/inngest';
import { supabase } from '@/lib/supabase';

export const onTaskCreated = inngest.createFunction(
  { id: 'on-task-created' },
  { event: 'task.created' },
  async ({ event }) => {
    const taskId = event.data.taskId as string;
    await supabase.from('follow_ups').insert({
      task_id: taskId,
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      channel: 'app',
      message_draft: 'Reminder: follow up on this task',
    });
  }
);

export const escalationCheck = inngest.createFunction(
  { id: 'escalation-check', cron: '0 * * * *' },
  { event: 'schedule/cron' },
  async () => {
    const { data: overdue } = await supabase
      .from('tasks')
      .select('id, owner_id, title')
      .lt('due_at', new Date().toISOString())
      .neq('status', 'done');

    for (const task of overdue || []) {
      await supabase.from('follow_ups').insert({
        task_id: task.id,
        scheduled_at: new Date().toISOString(),
        escalation_level: 1,
        channel: 'app',
        message_draft: `ESCALATED: ${task.title}`,
      });
    }
  }
);
```

- [ ] **Step 2: Register and commit**

```ts
// src/lib/inngest/functions/index.ts
export { classifyAndDebounce } from './classify-and-debounce';
export { handleBatch } from './handle-batch';
export { onTaskCreated, escalationCheck } from './follow-ups';
```

```ts
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import * as functions from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(functions),
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/inngest/functions/follow-ups.ts src/lib/inngest/functions/index.ts src/app/api/inngest/route.ts
git commit -m "feat: add follow-up and escalation engine"
```

---

## Task 12: Internal API Routes

**Files:**
- Create: `src/app/api/messages/route.ts`
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/contacts/route.ts`
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/app/api/approvals/route.ts`

**Interfaces:**
- Consumes: Supabase tables
- Produces: JSON data for frontend

- [ ] **Step 1: Implement API routes**

Each route is a thin wrapper around Supabase. Example for tasks:

```ts
// src/app/api/tasks/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, contact:contacts(*), owner:team_members(*)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { id, status, owner_id } = await req.json();
  const { data, error } = await supabase
    .from('tasks')
    .update({ status, owner_id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

Implement similar GET handlers for `/api/messages`, `/api/contacts`, `/api/dashboard` (stats), and `/api/approvals` (pending follow-ups).

- [ ] **Step 2: Commit**

```bash
git add src/app/api/messages/ src/app/api/tasks/ src/app/api/contacts/ src/app/api/dashboard/ src/app/api/approvals/
git commit -m "feat: add internal API routes"
```

---

## Task 13: Frontend Dashboard and Approvals

**Files:**
- Create: `src/components/MessageFeed.tsx`
- Create: `src/components/TaskBoard.tsx`
- Create: `src/components/ApprovalQueue.tsx`
- Create: `src/components/DashboardStats.tsx`
- Create: `src/components/RealtimeProvider.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/approvals/page.tsx`

**Interfaces:**
- Consumes: internal API routes, Supabase realtime
- Produces: interactive UI

- [ ] **Step 1: Create RealtimeProvider**

```tsx
// src/components/RealtimeProvider.tsx
'use client';
import { createClient } from '@supabase/supabase-js';
import { ReactNode, useEffect } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function RealtimeProvider({ children, onUpdate }: { children: ReactNode; onUpdate: () => void }) {
  useEffect(() => {
    const channel = supabase
      .channel('loop-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_messages' }, onUpdate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return <>{children}</>;
}
```

- [ ] **Step 2: Build dashboard page**

```tsx
// src/app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { MessageFeed } from '@/components/MessageFeed';
import { TaskBoard } from '@/components/TaskBoard';
import { DashboardStats } from '@/components/DashboardStats';

export default function DashboardPage() {
  const [refresh, setRefresh] = useState(0);

  return (
    <RealtimeProvider onUpdate={() => setRefresh(r => r + 1)}>
      <main className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Loop Ops Dashboard</h1>
        <DashboardStats key={refresh} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MessageFeed key={`m-${refresh}`} />
          <TaskBoard key={`t-${refresh}`} />
        </div>
      </main>
    </RealtimeProvider>
  );
}
```

- [ ] **Step 3: Implement components**

`MessageFeed.tsx` fetches `/api/messages` and lists recent inbound messages.

`TaskBoard.tsx` fetches `/api/tasks` and renders Kanban columns with drag-free cards.

`ApprovalQueue.tsx` fetches `/api/approvals`, shows pending follow-ups, and calls `POST /api/approvals/:id/approve`.

`DashboardStats.tsx` fetches `/api/dashboard` and shows counts.

- [ ] **Step 4: Commit**

```bash
git add src/components/ src/app/page.tsx src/app/approvals/page.tsx
git commit -m "feat: add dashboard and approvals UI"
```

---

## Task 14: Deployment and Smoke Tests

**Files:**
- Modify: `.env.local`
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous tasks
- Produces: live deployed app

- [ ] **Step 1: Deploy to Vercel**

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard.

- [ ] **Step 2: Configure Twilio webhook**

Set Twilio WhatsApp sandbox webhook to `https://<your-domain>/api/webhooks/whatsapp`.

- [ ] **Step 3: Configure Inngest**

```bash
npx inngest-cli@latest dev
```

For production, Inngest will sync automatically via the `/api/inngest` route.

- [ ] **Step 4: Smoke test**

1. Open dashboard.
2. Send WhatsApp message: "Need a quote for 20 office chairs by Friday."
3. Within 2–3 seconds (demo mode), task appears.
4. Approve a drafted follow-up.
5. Mark task done and verify loop closes.

- [ ] **Step 5: Commit and tag**

```bash
git add README.md
git commit -m "docs: add deployment instructions"
git tag v0.1.0
```

---

## Self-Review Checklist

- [ ] Every task ends with a testable deliverable.
- [ ] No TBD/TODO/placeholder steps remain.
- [ ] Ref resolution is explicitly implemented in Task 9.
- [ ] Demo mode debounce is configurable via `DEMO_MODE` env var.
- [ ] Outbound messages are excluded from agent pipeline in Task 5.
- [ ] Single demo org is assumed; no auth/RLS code is introduced.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-loop-implementation-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`.
