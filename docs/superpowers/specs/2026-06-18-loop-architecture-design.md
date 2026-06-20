# Loop Architecture Design v3

> **Project:** Loop — AI operations agent that lives inside WhatsApp, email, and voice notes.  
> **Stack:** Next.js + Supabase + Inngest + Groq + OpenRouter, deployed on Vercel.  
> **Date:** 2026-06-18 (rev. 3, final)  
> **Status:** Ready for implementation planning

---

## 1. Design rationale

This architecture is optimized for a **hackathon demo that looks like a real agent**, not a workflow automation backend. The final version centers on:

1. **Visible agentic behavior:** an LLM planner reasons over operational memory and calls tools via a deterministic executor.
2. **Ruthless scope reduction:** one hardcoded demo org, no multi-tenancy, no roles, no audit logs, no retention, no RLS, no auth.
3. **Reliable transcription:** Groq Whisper + faster-whisper fallback.
4. **Noise reduction:** cheap rules-based pre-classifier + Inngest debounce before extraction.
5. **Free deployment:** Vercel + Supabase + Inngest free tiers, Groq and OpenRouter free tiers for AI.

**Why this stack wins:**
- **Supabase:** Postgres, realtime, storage, edge functions.
- **Inngest:** durable workflows, cron, retries, debounce, fan-out.
- **Groq:** fast, free Whisper transcription and fast/cheap LLM inference.
- **OpenRouter:** fallback free models when Groq is unavailable.
- **Vercel:** free hosting, preview deploys, global CDN.
- **Twilio:** WhatsApp sandbox for development.

---

## 2. The agentic core

The system is a **planner + executor** agent, not an ETL pipeline.

### 2.1 Planner + executor pattern

The **planner** is an LLM that reasons over:
- the current message batch,
- recent conversation history,
- open tasks for the contact,
- team member availability,
- available tools.

It emits a list of **tool calls with local refs**. The **executor** runs them in order, maintaining a `ref → UUID` map so later calls can reference records created by earlier calls.

Deterministic rules are **guardrails/fallbacks**, not the brain.

### 2.2 Agent tools

| Tool | Purpose |
|---|---|
| `create_task` | Create a task from an extracted action item. |
| `assign_owner` | Pick a team member by team and availability. |
| `schedule_followup` | Schedule a reminder or escalation. |
| `draft_message` | Draft an outbound follow-up for approval. |
| `escalate` | Notify manager when a task is stuck. |
| `link_to_contact` | Resolve or create a contact. |
| `ignore` | Mark the message as noise and stop. |
| `ask_human` | Route to human review when confidence is low. |

`classify_message` is removed from the planner — the cheap pre-classifier handles classification before the planner is invoked.

### 2.3 Planner output format

Tool calls use local refs for cross-tool references:

```json
[
  {
    "ref": "contact_1",
    "tool": "link_to_contact",
    "args": { "phone": "+923****4567", "name": "Ali Traders" }
  },
  {
    "ref": "task_1",
    "tool": "create_task",
    "args": {
      "contact_ref": "contact_1",
      "title": "Prepare quote for 20 office chairs",
      "team": "sales",
      "due_in_hours": 4
    }
  },
  {
    "tool": "assign_owner",
    "args": { "task_ref": "task_1", "team": "sales" }
  },
  {
    "tool": "schedule_followup",
    "args": { "task_ref": "task_1", "in_hours": 2, "escalation_level": 0 }
  }
]
```

### 2.4 Executor ref resolution

The executor maintains an in-memory map:

```ts
const refs: Map<string, string> = new Map();

for (const call of plan) {
  // Resolve any ref arguments to real UUIDs
  const resolvedArgs = resolveRefs(call.args, refs);
  
  // Execute the tool
  const result = await executeTool(call.tool, resolvedArgs);
  
  // If the tool created a record, store its UUID under the ref
  if (call.ref && result.id) {
    refs.set(call.ref, result.id);
  }
}
```

**This is the critical path.** Without it, `assign_owner` and `schedule_followup` will fail because they reference a task that does not yet exist.

### 2.5 Planner prompt (condensed)

```
You are Loop, an operations agent for a small team.

Current message batch:
{message_batch}

Contact: {contact.name} | {contact.phone}
Recent context (last 5 messages + open tasks):
{retrieved_context}

Team members:
{team_members}

Available tools:
- link_to_contact
- create_task
- assign_owner
- schedule_followup
- draft_message
- escalate
- ignore
- ask_human

Rules:
- Only create tasks for concrete next actions.
- If a task already exists for the same commitment, skip it.
- Use refs for cross-tool references.
- If confidence is low, use ask_human.
- If the message is pure noise, use ignore.

Return a JSON array of tool calls. Each call may have a "ref" string.
```

---

## 3. High-level system architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │     │   Email         │     │  Voice / Manual │
│   (Twilio)      │     │   (Resend/Gmail)│     │  (Upload UI)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                         │                         │
         └─────────────────────────┬─────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Next.js API route       │
                    │  (webhook ingestion)     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Supabase Postgres     │
                    │   raw_messages table    │
                    │   + Storage for audio   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │        Inngest          │
                    │   pre-classifier +      │
                    │   debounce + workflow   │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼──────┐      ┌──────────▼──────────┐   ┌──────────▼──────────┐
│ Groq /        │      │  Supabase Realtime  │   │  Supabase Storage   │
│ OpenRouter    │      │  (live dashboard)   │   │  (audio/attachments) │
│ LLM planner │      └─────────────────────┘   └─────────────────────┘
└──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Next.js App         │
                    │   Dashboard + Task UI    │
                    │   (deployed on Vercel)   │
                    └─────────────────────────┘
```

---

## 4. Core data model (MVP only)

### 4.1 `team_members`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | Display name |
| team | text | `sales`, `operations`, `finance`, `admin` |
| phone | text | Optional, for notifications |
| email | text | Optional |
| created_at | timestamptz | |

**Note:** No `workload` cache. Compute open task count via `COUNT(*) WHERE status != 'done'` when assigning owners.

### 4.2 `contacts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| phone | text | Unique, nullable |
| email | text | Unique, nullable |
| metadata | jsonb | Free-form customer info |
| created_at | timestamptz | |

**Unique constraints:** `UNIQUE(phone)` and `UNIQUE(email)` separately, allowing nulls. This prevents duplicate contacts from parallel message ingestion.

### 4.3 `raw_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| contact_id | uuid | FK, nullable until resolved |
| external_id | text | Twilio MessageSid, email Message-ID, etc. |
| channel | text | `whatsapp`, `email`, `voice`, `manual` |
| direction | text | `inbound` or `outbound` |
| content | text | Text content or transcribed text |
| media_url | text | Image/attachment URL |
| audio_url | text | Stored audio file URL |
| status | text | `pending`, `noise`, `extracted`, `failed`, `review_needed` |
| raw_payload | jsonb | Original payload for debugging |
| created_at | timestamptz | |

### 4.4 `tasks`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| raw_message_id | uuid | FK |
| contact_id | uuid | FK |
| title | text | |
| description | text | |
| status | text | `open`, `in_progress`, `done`, `cancelled` |
| priority | text | `low`, `medium`, `high`, `critical` |
| owner_id | uuid | FK → team_members |
| due_at | timestamptz | |
| source_url | text | Link back to original message |
| plan_snapshot | jsonb | The planner's tool-call output for this task |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 4.5 `follow_ups`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK |
| scheduled_at | timestamptz | When to send |
| sent_at | timestamptz | Nullable |
| escalation_level | int | 0 = reminder, 1 = manager, etc. |
| channel | text | `whatsapp`, `email`, `app` |
| message_draft | text | |
| status | text | `scheduled`, `pending_approval`, `sent`, `failed` |
| created_at | timestamptz | |

### 4.6 `message_embeddings` (optional, for memory layer)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| raw_message_id | uuid | FK |
| embedding | vector | Match dimension to chosen embedder (e.g., 768 for nomic-embed-text, 1024 for e5). Requires `pgvector` extension. |
| content_type | text | `message`, `task`, `contact_note` |
| created_at | timestamptz | |

### 4.7 `runs` (agent traceability)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| raw_message_id | uuid | FK |
| model | text | |
| prompt_tokens | int | |
| completion_tokens | int | |
| plan_json | jsonb | Tool calls produced by planner |
| outcome_json | jsonb | Results of executing the plan |
| latency_ms | int | |
| created_at | timestamptz | |

---

## 5. Ingestion pipeline

### 5.1 WhatsApp ingestion
1. Twilio WhatsApp sandbox sends POST to `/api/webhooks/whatsapp`.
2. Verify Twilio signature.
3. If `direction == 'outbound'`, store the message for record-keeping but **do not emit `message.received`** — prevents the agent from reacting to its own replies.
4. If `direction == 'inbound'`:
   - Upsert `contact` by `phone`.
   - Store message in `raw_messages` with `status = 'pending'`.
   - If audio, download to Supabase Storage.
   - Emit Inngest event `message.received`.

### 5.2 Email ingestion
1. Resend/Gmail inbound webhook sends to `/api/webhooks/email`.
2. Parse body and attachments.
3. Upsert contact by `email`.
4. Store message.
5. Emit `message.received`.

### 5.3 Voice / manual upload
1. Frontend uploads audio or typed note.
2. Audio stored in Supabase Storage.
3. `raw_messages` row created with `channel = 'voice'` or `channel = 'manual'`.
4. Emit `message.received`.

### 5.4 Idempotency
All handlers check `external_id` before insert to prevent duplicate processing.

---

## 6. Pre-classifier + debounce

### 6.1 Pre-classifier
On `message.received`, run a cheap classifier before expensive extraction.

**Rules-based gate (fast, free):**
- If content is empty or only contains: `ok`, `thanks`, `done`, `👍`, `👌`, `got it`, `will do`, `noted`, `— mark as `noise` and stop.
- If content contains action verbs like: `send`, `quote`, `check`, `call`, `pay`, `book`, `confirm`, `deliver`, `follow up`, `prepare`, `order` — proceed.
- If uncertain, use a tiny LLM call (Groq `llama-3.1-8b-instant`) to classify as `noise`, `task`, or `unclear`.

Messages classified as `noise` are stored with `status = 'noise'` and never reach the planner.

### 6.2 Debounce / buffering
After classification, use Inngest `debounce` to wait for follow-up messages from the same contact.

- **Production window:** 10 seconds for text, 30 seconds for voice.
- **Demo window:** 2 seconds for text, 3 seconds for voice when `DEMO_MODE=true`.
- **Trigger:** after the window closes, emit `message.batch_ready` with the buffered message IDs.
- **Benefit:** combines rapid messages into one context block, reducing fragmented tasks and duplicate follow-ups.
- **Demo-day note:** pre-seed the dashboard with demo tasks and use a single live message to trigger an update within 2–3 seconds.

---

## 7. Agent engine

### 7.1 `handle-message-batch` (Inngest)
**Trigger:** `message.batch_ready`  
**Steps:**
1. Load all messages in the batch.
2. If any message has audio, transcribe with Groq Whisper.
3. Build context: contact, recent messages (LIMIT 5), open tasks, team members.
4. Call the **planner LLM** with tool schema.
5. Parse returned tool calls with refs.
6. Execute calls in order, resolving refs to UUIDs as records are created.
7. Insert `runs` row with the plan and outcome.
8. Emit `task.created` / `follow_up.scheduled` / `human.review_needed` events.

### 7.2 Transcription
Use **Groq Whisper** for audio:
- Endpoint: `https://api.groq.com/openai/v1/audio/transcriptions`
- Model: `whisper-large-v3`
- Fast, free tier generous, reliable for voice notes.

Fallback: local `faster-whisper` if Groq is unavailable.

### 7.3 LLM models

| Purpose | Primary | Fallback |
|---|---|---|
| Planner / extraction | Groq `llama-3.3-70b-versatile` | OpenRouter `qwen/qwen-2.5-72b-instruct` |
| Pre-classifier | Groq `llama-3.1-8b-instant` | Rules-based gate |
| Transcription | Groq `whisper-large-v3` | local `faster-whisper` |
| Embeddings (optional) | any free model (e.g., `nomic-embed-text` via OpenRouter) | — |

**Demo-day fallback:** use a cheap GPT-4o-mini or Claude Haiku if free models are unstable. Use only as a last resort.

### 7.4 Tool execution

```ts
type ToolName =
  | "create_task"
  | "assign_owner"
  | "schedule_followup"
  | "draft_message"
  | "escalate"
  | "link_to_contact"
  | "ignore"
  | "ask_human";

interface ToolCall {
  ref?: string;
  tool: ToolName;
  args: Record<string, any>;
}
```

Execution order:
- `link_to_contact` runs first.
- `create_task` runs next, using `contact_ref` if needed.
- `assign_owner` uses `task_ref`.
- `schedule_followup` uses `task_ref`.
- `draft_message` can run independently.

The executor resolves `*_ref` arguments to UUIDs from the `refs` map before calling the tool function.

### 7.5 Deterministic guardrails
If the planner fails or produces invalid tool calls:
1. Rule-based intent detection (sales/ops/finance/admin keywords).
2. Create a single task with `review_needed` status.
3. Notify the admin in the dashboard.

---

## 8. Follow-up / loop-closing engine

### 8.1 `on-task-created`
**Trigger:** `task.created`  
**Steps:**
1. Emit in-app notification via Supabase Realtime.
2. If owner has phone, schedule WhatsApp reminder.
3. If owner has email, schedule email reminder.

### 8.2 `send-follow-up`
**Trigger:** `follow_up.due`  
**Steps:**
1. Load task and owner.
2. Draft reminder message.
3. **Approval-only by default:** put message in `pending_approval` queue.
4. Admin/owner clicks approve in dashboard → message is sent.
5. If escalation level >= 1, also notify manager.
6. Mark `follow_up.sent_at`.

### 8.3 `escalation-check` (cron)
**Schedule:** Every hour  
**Steps:**
1. Find tasks where `due_at < now()` and `status != 'done'`.
2. Emit escalation events.
3. Update dashboard risk view.

### 8.4 `close-loop`
**Trigger:** task marked `done`  
**Steps:**
1. Cancel pending follow-ups.
2. Optionally send closing confirmation to contact.
3. Log outcome to `runs`.

---

## 9. Memory / retrieval layer (optional, moat story)

### 9.1 Why it matters
The thesis is "operational memory + compounding context." The schema stores rows; embeddings give the planner a real memory surface.

### 9.2 Implementation
1. Enable `pgvector` extension in Supabase.
2. Generate embeddings for `raw_messages.content` and `tasks.title` using a free embedding model.
3. Store in `message_embeddings`.
4. Before calling the planner, retrieve top-k similar past messages for the contact.
5. Include them in the planner context.

### 9.3 MVP stance
- **Keep it optional.** If time is short, use `ORDER BY created_at DESC LIMIT 5` retrieval.
- Mention embeddings as the "compounding context" moat in the pitch.
- Match `vector` column dimension to the chosen embedding model (e.g., 768 for `nomic-embed-text`, 1024 for other models).

---

## 10. Frontend

### 10.1 Tech
- Next.js 14 App Router
- Tailwind CSS
- shadcn/ui
- Supabase client for data + realtime
- **No auth in MVP** — single hardcoded demo session.

### 10.2 Screens

#### Splash / onboarding
- Single “Enter demo” button.
- Demo org, team members, and contacts are pre-seeded.

#### Manager / ops dashboard (default view)
- Live inbox of new messages.
- Overdue tasks.
- Unassigned tasks.
- Pending approvals (the one-tap approve moment).
- Average response time.
- “12 things handled, 2 need you” digest.
- Realtime updates via Supabase subscriptions.

#### Task board
- Kanban: Open / In Progress / Done.
- Filter by owner, priority, channel.
- Card shows title, owner, due date, source snippet.
- Detail drawer: source message, planner tool calls, timeline, follow-ups.

#### Contact view
- Conversation history.
- Open tasks.
- Quick note / manual task creation.

#### Approvals queue
- List of pending outbound messages.
- One-tap approve / edit / reject.

#### Settings
- Team members (decoupled from auth).
- Channels (single WhatsApp number, single email).
- SLA rules.
- AI model picker (Groq / OpenRouter).
- Demo mode toggle.

---

## 11. API routes

### Webhooks
- `POST /api/webhooks/whatsapp` — Twilio WhatsApp webhook
- `POST /api/webhooks/email` — Resend/Gmail inbound webhook

### Internal API
- `GET /api/messages` — list messages
- `GET /api/tasks` — list tasks
- `PATCH /api/tasks/:id` — update task status/owner
- `GET /api/contacts` — list contacts
- `GET /api/contacts/:id` — contact detail
- `POST /api/tasks/manual` — create manual task
- `POST /api/follow-ups/:id/approve` — approve pending outbound message
- `GET /api/dashboard` — dashboard stats
- `GET /api/approvals` — pending approval queue

### Inngest
- `POST /api/inngest` — Inngest serve endpoint

---

## 12. Environment variables

```env
# Vercel / app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_MODE=false

# Groq (transcription + fast LLM)
GROQ_API_KEY=
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3
GROQ_PLANNER_MODEL=llama-3.3-70b-versatile
GROQ_CLASSIFIER_MODEL=llama-3.1-8b-instant

# OpenRouter (fallback LLM)
OPENROUTER_API_KEY=
OPENROUTER_FALLBACK_MODEL=qwen/qwen-2.5-72b-instruct

# Inngest
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

---

## 13. Security & privacy (MVP)

- **Single demo session:** no auth in the hackathon build. All data is the demo org's data.
- **Webhook signatures:** Twilio and Resend signatures verified.
- **Secrets:** all API keys in Vercel environment variables, never in client code.
- **Human approval:** outbound messages require approval by default.
- **Consent:** onboarding notice that messages are processed by AI.

---

## 14. Error handling & reliability

- **Ingestion failures:** mark `raw_messages.status = 'failed'` and show in retry queue.
- **Extraction failures:** Inngest retries with backoff; fallback to guardrail rules.
- **LLM failures:** fallback from Groq to OpenRouter to rule-based.
- **Audio failures:** keep audio file and flag for manual transcription.
- **Duplicate protection:** `external_id` idempotency + unique contact constraints.
- **Agent plan failures:** invalid refs or tool calls fall back to `ask_human`.
- **Outbound re-ingestion:** only inbound messages trigger the agent pipeline.

---

## 15. Testing strategy

- **Unit tests:** pre-classifier, ref resolver, tool executor, routing guardrails.
- **Integration tests:** Inngest agent flow with mocked Groq.
- **E2E tests:** WhatsApp message → debounce → planner → task → approval → dashboard.
- **Demo tests:** pre-seed demo org with realistic messages and voice notes; verify 2–3 second demo window.

---

## 16. Deployment

1. Create Supabase project (free tier).
2. Enable `pgvector` extension (optional, for embeddings).
3. Run migrations to create tables.
4. Seed demo org, team members, and contacts.
5. Create Vercel project and link to GitHub repo.
6. Add environment variables.
7. Deploy Inngest functions (`npx inngest-cli@latest dev` locally, then sync to cloud).
8. Configure Twilio WhatsApp sandbox webhook URL.
9. Configure Resend/Gmail inbound webhook.
10. Smoke test: send a WhatsApp voice note and watch it become a tracked task with pending approval in 2–3 seconds (demo mode).

---

## 17. Roadmap (post-MVP)

- Multi-tenancy and organizations.
- Auth (Supabase Auth) and roles.
- Audit logs and compliance.
- Data retention policies.
- Third-party integrations (Slack, Notion, HubSpot).
- Advanced memory with embeddings.
- Multiple WhatsApp numbers per org.

---

## 18. Next step

Architecture is finalized. Invoke `superpowers:writing-plans` to create a detailed, step-by-step implementation plan with file names, package choices, and a build order.
