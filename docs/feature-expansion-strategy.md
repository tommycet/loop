# Loop Feature Expansion Strategy

## What judges need to believe

> "This solves a problem I've actually seen. Not a hypothetical. Not a 'wouldn't it be cool.' A real, expensive, recurring failure mode that no existing tool addresses."

The research confirms the gap is real and wide:

**Shared inbox tools** (Wati, Gallabox, Trengo, Front, Missive) = message routing. They answer "who replies to what."

**CLM tools** (Agiloft, Sirion, Icertis) = formal contract obligation extraction. They scan signed PDFs, not chat.

**Nobody** detects informal commitments made in chat, risk-grades them, routes for approval, locks risky actions, and proves execution.

Loop sits in that gap. The features below make the gap undeniable.

---

## Tier 1: Build these for the hackathon demo (highest judge impact)

### 1. Live channel ingestion (WhatsApp + Telegram + Email)

**Why**: The demo currently uses seeded data. Judges will ask "does this work with real messages?" The answer must be yes.

**What to build**:

| Channel | Method | Free tier | Build time |
|---|---|---|---|
| **Telegram** | Bot API webhook → `/api/inbound/telegram` | Unlimited, no verification | ~1 hour |
| **WhatsApp** | Meta Cloud API webhook → `/api/inbound/whatsapp` | 1,000 conversations/mo free | ~3 hours |
| **Email** | Cloudflare Email Workers → `/api/inbound/email` | Unlimited on free tier | ~2 hours |
| **Voice notes** | Download media → Groq Whisper `whisper-large-v3-turbo` | 2,000 req/day free | ~1 hour |

**Unified data model** (already partially exists in Supabase):
```sql
messages (
  id uuid primary key,
  channel text not null,          -- 'whatsapp' | 'telegram' | 'email' | 'voice'
  external_id text not null,      -- platform message ID for dedup
  from_id text not null,          -- sender phone/chat ID/email
  from_name text,
  body_text text,                 -- transcribed if voice
  media_url text,
  media_type text,                -- 'audio' | 'image' | 'document'
  is_voice_note boolean default false,
  transcription text,             -- Whisper output
  raw_payload jsonb,
  received_at timestamptz default now(),
  unique(channel, external_id)
)
```

**Judge demo flow**: Send a real WhatsApp/Telegram message to the bot → watch it appear in the dashboard → watch the AI detect a commitment → watch it route to the authority queue.

**Architecture**:
```
Telegram webhook ─┐
WhatsApp webhook ─┼─→ /api/inbound/{channel} ─→ normalize ─→ Supabase
Email Worker ─────┘                                       ↓
                                                   Groq Whisper (if voice)
                                                          ↓
                                                   Groq LLM (detect commitment)
                                                          ↓
                                                   Authority queue + audit
```

### 2. Voice note transcription pipeline

**Why**: In Pakistan, India, Brazil, and most emerging markets, voice notes ARE the business. A tool that can't handle voice is irrelevant to 2B+ people.

**What to build**:
- When a voice note arrives via any channel, download the media file
- Send to Groq Whisper `whisper-large-v3-turbo` ($0.04/hour, 228x real-time, 12% WER)
- Store transcription in `messages.transcription`
- Feed the transcription (not the raw audio) into the commitment detection LLM
- Show the transcription in the UI with a "voice note" badge

**Demo moment**: Judge sends a voice note saying "I can give you 15% off if you pay today" → Loop transcribes it in <1 second → detects the discount commitment → routes to admin for approval.

**Groq is already in the stack.** The same API key that powers the LLM planner powers Whisper. Zero new dependencies.

### 3. Visual flow builder (React Flow + domain-specific nodes)

**Why**: This is the "wow factor" feature. Judges love visual builders. It turns Loop from a "smart inbox" into a "platform."

**What to build**:

A `/app/flows` page with a React Flow canvas where admins drag-and-drop nodes to build automation rules:

**Node types** (domain-specific, not generic):
- **Trigger nodes**: "Commitment detected", "Delivery promise made", "Discount offered", "Payment claimed", "Complaint received"
- **Condition nodes**: "Risk tier = high", "Discount > threshold", "Customer is repeat", "Stock below level"
- **Action nodes**: "Route to role", "Send notification", "Create task", "Escalate", "Lock action", "Send auto-reply"

**Example flow an admin builds**:
```
[Delivery promise made]
        ↓
[Stock below threshold?]
   ├── YES → [Route to Operations Manager] → [Lock action until approved]
   └── NO  → [Auto-confirm delivery date] → [Log to audit trail]
```

**Implementation**:
- `@xyflow/react` (MIT, 37K stars, used by Zapier/Stripe/Typeform)
- Flows saved as JSON in Supabase `flows` table
- Simple execution engine: Next.js API route that traverses the flow graph on trigger events
- Pre-built templates: "Low stock alert", "High discount approval", "Repeat complaint escalation"

**Licensing note**: Don't embed n8n's editor — OEM license is ~$50K/year. Build custom with React Flow (MIT). Activepieces (MIT) is an alternative if you want a full platform later.

### 4. Real-time commitment detection on live messages

**Why**: The current demo detects commitments from seeded data. Real-time detection on live messages is the proof that this works at scale.

**What to build**:
- When a new message lands in Supabase (from any channel webhook), trigger the commitment detection pipeline
- Use Supabase Realtime (free, built-in) to subscribe to new messages
- Run the existing `commitment-detect.ts` + `risk.ts` + `authority.ts` pipeline on each new message
- Push detected commitments to the authority queue in real-time
- Show a live "detection feed" in the dashboard

**Demo moment**: Judge sends a message → commitment appears in the queue within 2 seconds → judge approves it → audit event logged.

---

## Tier 2: Build if time permits (strong differentiators)

### 5. Daily digest via WhatsApp/Telegram

**Why**: The "morning standup" pattern. Teams in emerging markets live on WhatsApp. A daily digest sent TO WhatsApp (not just displayed in a dashboard) is the "it just works" moment.

**What to build**:
- Cron job (Inngest or Supabase scheduled function) runs at 7:00 AM local time
- Queries all open commitments, pending approvals, overdue items, completed tasks
- Formats as a concise WhatsApp/Telegram message
- Sends via the same channel API that receives messages
- Format:
  ```
  Loop Daily Digest — 7:00 AM
  
  3 commitments need your attention:
  • 15% discount to Ahmed (awaiting admin approval)
  • Delivery promise to Fatima (overdue 2 days)
  • Payment claim from Bilal (awaiting finance verification)
  
  2 tasks completed yesterday.
  1 escalation pending.
  
  Reply with any commitment ID to see details.
  ```

### 6. Evidence pack export (PDF/CSV)

**Why**: The audit trail is only useful if you can share it. Disputes, compliance reviews, investor due diligence — all need exportable proof.

**What to build**:
- "Export evidence pack" button on each commitment
- Generates a PDF with: original conversation, detected commitment, risk assessment, approval chain, execution proof, audit timeline
- Also CSV export of the full audit log for compliance teams

### 7. Authority rule editor (visual)

**Why**: Currently authority rules are seeded in SQL. Letting admins edit them through the UI makes the "control plane" real.

**What to build**:
- `/app/admin/rules` page with a table of authority rules
- Inline editing: action type, required role, threshold, fail mode (block/escalate/draft_only)
- "Test rule" button: paste a sample message, see which rule fires and what happens
- Changes logged to audit trail

---

## Tier 3: Mention in pitch, build post-hackathon

### 8. n8n integration (backend, not embedded)

**Approach**: Self-host n8n via Docker alongside Supabase. Loop triggers n8n workflows via webhook for advanced integrations (ERP sync, inventory checks, accounting). SUL-compliant because it's internal use with Loop's own credentials.

**Don't embed n8n's UI** — OEM license is $50K/year and the UI is too complex for non-technical admins. Build a custom flow builder with React Flow instead (see #3 above).

**Alternative**: Activepieces (MIT licensed, embeddable commercially, simpler UI than n8n). If the flow builder becomes a core product feature post-hackathon, evaluate Activepieces for embedding.

### 9. Slack integration

**Method**: `@slack/bolt` SDK with Socket Mode (no public URL needed for hackathon). Listen for `message.im` events, normalize to the unified message schema, feed into the detection pipeline.

**Build time**: ~30 minutes. Free.

### 10. Instagram DM support

**Method**: Messenger API for Instagram via Meta Developer Platform. Same webhook infrastructure as WhatsApp Cloud API. Requires Instagram Business account + Facebook Page + potentially App Review (days/weeks for Advanced Access).

**Verdict**: Lower priority. Add if team has accounts ready, skip for v1.

### 11. Compliance export for regulated industries

**The hook**: JPMorgan was fined $200M for WhatsApp off-channel communications. $3B+ in total penalties across 100+ firms by 2025. FINRA now holds individuals personally liable.

**What to build**: Immutable message archive export (WORM-compliant format) + supervisory review dashboard. This is the enterprise upsell path.

---

## Competitive landscape (for the pitch)

| Category | Tools | What they do | What they DON'T do |
|---|---|---|---|
| Shared inbox | Wati, Gallabox, Trengo, Front, Missive | Route messages, team collaboration | Detect commitments, risk-grade, approve, lock, audit |
| CLM / Obligation | Agiloft, Sirion, Icertis | Extract obligations from formal contracts | Scan chat/email/voice for informal commitments |
| Compliance | LeapXpert, Jatheon | Archive messages for regulated industries | Detect, grade, or manage commitments |
| **Loop** | — | **Detects informal commitments in real-time chat, risk-grades, routes for approval, locks risky actions, proves execution** | — |

**The gap is undeniable.** Nobody does what Loop does.

---

## Killer stats for the pitch

| Stat | Source |
|---|---|
| 200M+ businesses use WhatsApp Business globally | Meta 2025 |
| 80% of SMBs in India/Brazil use WhatsApp for business comms | Forbes/Gallabox |
| 98% WhatsApp open rate vs 20% email | Wapikit 2025 |
| Users respond to WhatsApp in 45-90 seconds vs 6+ hours for email | Wizmessage 2025 |
| 5-9% of annual revenue lost to poor obligation management (formal contracts only) | PwC / Agiloft |
| ~9% of contracts experience significant disputes; verbal agreements higher | Concord |
| JPMorgan fined $200M for WhatsApp off-channel comms; $3B+ total | SEC/CFTC 2021-2025 |
| 96% of customers leave after a bad experience | Gartner |
| US companies lose $75B/year to poor service | Forbes/Oxford 2024 |
| WhatsApp Business messaging market: $3.8B (2024) → $19.2B (2033) | Growth Market Reports |
| 74.6% trust a business more when they can message it; 72.4% more likely to buy | Meta/Kantar 2025 |
| 40%+ of agentic AI projects will be canceled by 2027 (Gartner) — Loop avoids this by tying AI to a workflow you can name, with audit and override | Gartner June 2025 |

---

## Recommended hackathon build order

| Priority | Feature | Build time | Judge impact |
|---|---|---|---|
| 1 | Telegram bot webhook → live message ingestion | 1 hour | High — proves real input |
| 2 | Voice note transcription via Groq Whisper | 1 hour | Very high — emerging market relevance |
| 3 | Real-time commitment detection on live messages | 2 hours | Critical — proves the core loop works |
| 4 | WhatsApp Meta Cloud API webhook | 3 hours | High — the primary channel |
| 5 | Visual flow builder (React Flow, 5-6 node types) | 4 hours | Very high — "wow factor" |
| 6 | Daily digest via Telegram/WhatsApp | 2 hours | Medium — "it just works" |
| 7 | Evidence pack PDF export | 2 hours | Medium — compliance story |
| 8 | Authority rule editor UI | 2 hours | Medium — "control plane" proof |
| 9 | Email via Cloudflare Workers | 2 hours | Low-medium — completeness |
| 10 | Slack via Bolt SDK | 30 min | Low — checkbox feature |

**Total estimated build time**: ~20 hours for all 10 features. Prioritize 1-5 for the demo (11 hours).

---

## Technical architecture for live channels

```
                    ┌─────────────────┐
                    │  Telegram Bot   │
                    │  API Webhook    │
                    └────────┬────────┘
                             │
┌─────────────────┐    ┌─────▼──────────┐    ┌──────────────────┐
│  WhatsApp Meta  │    │  /api/inbound/  │    │  Supabase        │
│  Cloud API      ├───►│  {channel}      ├───►│  messages table  │
│  Webhook        │    │                  │    │  (unified schema) │
└─────────────────┘    │  1. Parse        │    └────────┬─────────┘
                       │  2. Normalize    │             │
┌─────────────────┐    │  3. Whisper (if  │             │ Supabase
│  Cloudflare     │    │     voice)       │    ┌────────▼─────────┐
│  Email Worker   ├───►│  4. Store        │    │  Realtime        │
│  → webhook      │    │  5. Trigger LLM  │    │  subscription    │
└─────────────────┘    └──────────────────┘    └────────┬─────────┘
                                                        │
                                               ┌────────▼─────────┐
                                               │  Commitment      │
                                               │  Detection       │
                                               │  (existing)      │
                                               └────────┬─────────┘
                                                        │
                                        ┌───────────────┼───────────────┐
                                        │               │               │
                               ┌────────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
                               │  Authority    │ │  Audit      │ │  Flow       │
                               │  Queue        │ │  Trail      │ │  Engine     │
                               │  (existing)   │ │  (existing) │ │  (new)      │
                               └───────────────┘ └─────────────┘ └─────────────┘
```

Each inbound webhook returns 200 immediately and processes asynchronously. The Supabase Realtime subscription picks up new messages and runs the detection pipeline.

---

## Flow builder architecture

```
┌──────────────────────────────────────────────┐
│  /app/flows (Admin UI)                       │
│  ┌────────────────────────────────────────┐  │
│  │  React Flow Canvas                     │  │
│  │  Node palette: Trigger / Condition /   │  │
│  │  Action (domain-specific)              │  │
│  │  Drag → connect → configure            │  │
│  └────────────────┬───────────────────────┘  │
│                   │ Save as JSON              │
└───────────────────┼──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│  Supabase                                    │
│  flows (id, name, definition jsonb, active)  │
│  flow_executions (id, flow_id, status, logs) │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│  Flow Execution Engine                       │
│  (Next.js API route or Inngest function)     │
│  - Triggered by Supabase Realtime events     │
│  - Traverses flow graph                      │
│  - Evaluates conditions                      │
│  - Executes actions (route, notify, lock)    │
│  - Logs each step to flow_executions         │
└──────────────────────────────────────────────┘
```

**Domain-specific node types** (what makes Loop's flow builder different from n8n/Zapier):

```typescript
type FlowNode =
  | { type: "trigger"; trigger: "commitment_detected" | "delivery_promise" | "discount_offer" | "payment_claim" | "complaint" | "follow_up" }
  | { type: "condition"; field: "risk_tier" | "discount_pct" | "delivery_hours" | "customer_tier" | "is_repeat"; operator: "eq" | "gt" | "lt" | "in"; value: unknown }
  | { type: "action"; action: "route_to_role" | "send_notification" | "create_task" | "escalate" | "lock_action" | "auto_reply" | "log_audit"; params: Record<string, unknown> }
```

Admins don't need 400 generic integrations. They need 10-15 domain-specific nodes that map directly to their business reality.

---

## What NOT to build (for the hackathon)

- **n8n embedding** — OEM license $50K/year, UI too complex for admins
- **Zapier/Make.com embedding** — can't embed in your app, external platforms only
- **Embedded iPaaS (Paragon, Prismatic)** — enterprise sales cycle, overkill for MVP
- **Instagram DM** — requires App Review (days/weeks), low ROI for hackathon
- **Full compliance archive** — enterprise feature, mention in pitch but don't build
- **Custom auth system** — the demo password gate is fine for hackathon

---

## The pitch narrative (30 seconds)

> "200 million businesses run on WhatsApp. Their employees make thousands of promises in chat every day — discounts, delivery dates, payment terms, follow-ups. None of these promises are tracked, approved, or audited. 5-9% of revenue is lost to poor obligation management. JPMorgan was fined $200M because they couldn't track what their employees promised in WhatsApp.
>
> Loop is the commitment control plane. It detects every promise made in chat, risk-grades it, routes risky actions to the right approver with evidence, locks the action until approved, and proves execution in an immutable audit trail. Nothing ships without authority.
>
> No shared inbox tool does this. No CLM tool scans chat. Loop is the missing layer between the inbox and the contract."
