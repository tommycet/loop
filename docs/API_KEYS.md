# API key setup — all channels + services

This file is the master reference for every key/env var the Loop stack
needs. Each section has:
- **What it's for** — quick description
- **Where to get it** — link + 3-6 step walkthrough
- **What to put in `.env.local`** — exact variable name + example value
- **How to verify** — one-line check you can run after

The keys are listed in **priority order** for the hackathon demo.
Skip the ones you don't need (every route works in demo mode without keys).

---

## Quick reference (paste into `.env.local`)

```bash
# === Required for live mode (already wired) ===
# Supabase — get from supabase.com/dashboard → Project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://skucqwqptusyyoxegqpk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ZQQ7RKIzoPrq1VIHWUGd_g_NC6Fqaw8
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# === Tunnel (already set) ===
LOOP_PUBLIC_URL=https://subaru-herald-exceptional-stable.trycloudflare.com

# === Channel 1: Telegram (recommended first) ===
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...

# === Channel 2: Groq (voice transcription) ===
GROQ_API_KEY=...

# === Channel 3: WhatsApp Meta Cloud API ===
META_WHATSAPP_TOKEN=...
META_PHONE_NUMBER_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...

# === Channel 4: Slack (recommended third) ===
SLACK_SIGNING_SECRET=...
SLACK_BOT_TOKEN=...
SLACK_APP_TOKEN=...           # only for Socket Mode (skip for now)
SLACK_MODE=webhook            # or "socket" for Bolt SDK

# === Channel 5: Email (Cloudflare Email Worker — manual setup) ===
EMAIL_WEBHOOK_SECRET=...      # YOU generate this; it's the shared secret
                              # between the CF Worker and this server

# === AI APIs (optional) ===
OPENROUTER_API_KEY=...        # already set

# === Background jobs ===
INNGEST_EVENT_KEY=...         # already set
INNGEST_SIGNING_KEY=...       # already set
INNGEST_API_URL=http://localhost:8288

# === Demo mode toggle ===
# Set to "false" (or remove) to switch from demo to live mode
FORCE_DEMO_MODE=true
```

After editing `.env.local`, restart the server:
```bash
cd /root/loop
pkill -9 -f "next-server"; sleep 1
rm -rf .next
FORCE_DEMO_MODE=true npm run start > /tmp/dev_start.log 2>&1 &
```

Then verify with:
```bash
curl -sS http://localhost:3000/api/health | python3 -m json.tool
```

---

## 1. Supabase (database + auth)

**What it's for:** Stores commitments, audit events, approval requests, authority rules, contacts, and messages.

**Where to get it:** https://supabase.com/dashboard

**Setup (5 min):**
1. Go to https://supabase.com/dashboard and sign in
2. Click **New Project**, pick a name + database password (save the password!)
3. Wait ~2 min for provisioning
4. Once ready, click **Project Settings** (gear icon) → **API**
5. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key (starts with `sb_publishable_`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key (starts with `sb_secret_`) → `SUPABASE_SERVICE_ROLE_KEY` (click "Reveal" first)
6. Run the migration:
   ```bash
   cd /root/loop
   psql "$DATABASE_URL" -f supabase/migrations/002_commitments.sql
   ```
   Get the connection string from **Project Settings** → **Database** → **Connection string** → **Transaction pooler** (port 6543).

**Verify:**
```bash
curl -sS http://localhost:3000/api/health | python3 -c "import json,sys; print(json.load(sys.stdin)['env']['supabase'])"
# Should print: True
```

**Free tier:** 500MB database, 2GB egress, 50k MAU. More than enough for a hackathon.

---

## 2. Cloudflare Tunnel (already set, but here's how to make it permanent)

**What it's for:** Public HTTPS URL that points back to localhost:3000. Used by Telegram, Slack, and Meta to call the webhook endpoints.

**Why it's currently ephemeral:** Account-less quick tunnels get recycled.

**Setup a named tunnel (10 min, stable URLs):**
1. Sign up at https://dash.cloudflare.com (free plan works)
2. **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**
3. Name it `loop-hackathon` → **Save tunnel**
4. Copy the token, run locally:
   ```bash
   sudo cloudflared service install <TOKEN>
   ```
5. **Public Hostname** tab → add:
   - Subdomain: `loop` (or pick your own)
   - Domain: pick a domain you own on Cloudflare, or use the free `trycloudflare.com`
   - Service: `http://localhost:3000`
6. Save → you'll get a permanent URL like `https://loop.yourdomain.com`
7. Update `.env.local`:
   ```bash
   LOOP_PUBLIC_URL=https://loop.yourdomain.com
   ```

**Verify:** Visit the URL in a browser — you should see the Loop landing page.

---

## 3. Telegram Bot (Feature 1 + 2 + 3)

**What it's for:** Receives messages from your Telegram bot, extracts commitments in real time, transcribes voice notes via Whisper.

**Where to get it:** Inside Telegram, talk to **@BotFather**

**Setup (3 min):**
1. Open Telegram, search `@BotFather`, start a chat
2. Send `/newbot`
3. Pick a name (e.g. `Loop Demo`) and username (must end in `bot`)
4. BotFather replies with the bot token → `TELEGRAM_BOT_TOKEN` (looks like `7123456789:AAHxyz...`)
5. Send `/setprivacy` → select your bot → **Disable** (so it sees all messages, not just `/commands`)
6. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR_TUNNEL/api/inbound/telegram&secret_token=loop_tg_2026"
   ```
   The `secret_token` value becomes `TELEGRAM_WEBHOOK_SECRET`. Telegram sends it back as the `X-Telegram-Bot-Api-Secret-Token` header on every webhook call.
7. Add to `.env.local`:
   ```bash
   TELEGRAM_BOT_TOKEN=7123456789:AAHxyz...
   TELEGRAM_WEBHOOK_SECRET=loop_tg_2026
   ```

**Verify:**
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
# Should show your URL + secret_token set
```
Then in Telegram, send your bot a message like `I can offer 20% off` and check `/app/commitments` — it should appear in <1s.

**Free:** Unlimited.

---

## 4. Groq (Whisper voice transcription, Feature 2)

**What it's for:** Transcribes Telegram voice notes so the commitment detector can analyze them.

**Where to get it:** https://console.groq.com

**Setup (2 min):**
1. Go to https://console.groq.com and sign up (Google/GitHub/email — no card needed)
2. Click **API Keys** in the left sidebar
3. Click **Create API Key**, name it `loop-hackathon`, click Submit
4. Copy the key (starts with `gsk_`) → `GROQ_API_KEY`. **This is the only time you'll see it.**
5. Add to `.env.local`:
   ```bash
   GROQ_API_KEY=gsk_...
   ```

**Verify:**
```bash
curl -sS http://localhost:3000/api/health | python3 -c "import json,sys; print(json.load(sys.stdin)['env']['groq'])"
# Should print: True
```
Then send a voice note to your Telegram bot.

**Free tier:** 14,400 audio-seconds/day, ~2,400 minutes. Way more than needed for a demo.

---

## 5. WhatsApp Meta Cloud API (Feature 4)

**What it's for:** Receives WhatsApp messages, same pipeline as Telegram.

**Where to get it:** https://developers.facebook.com/apps

**Setup (30 min, more involved than the others):**
1. Go to https://developers.facebook.com and create a Meta Developer account
2. **My Apps** → **Create App** → **Business** type → name it `Loop`
3. Add the **WhatsApp** product to your app
4. **WhatsApp** → **Getting Started**:
   - **Phone number**: Use the test number provided (or add your own business number)
   - **WhatsApp Business Account ID**: copy this → `META_PHONE_NUMBER_ID` (it's the phone number ID, not the number itself)
   - **Temporary access token** (24h) or generate a permanent **System User** token → `META_WHATSAPP_TOKEN`
5. **WhatsApp** → **Configuration** → **Webhook**:
   - **Callback URL**: `https://YOUR_TUNNEL/api/inbound/whatsapp-meta`
   - **Verify Token**: pick any string → `META_VERIFY_TOKEN` (e.g. `loop_meta_verify_2026`)
   - Click **Verify and save**
6. **App Settings** → **Basic** → **App Secret** → click **Show** → copy → `META_APP_SECRET`
7. **Webhook fields** — subscribe to: `messages`
8. Add to `.env.local`:
   ```bash
   META_WHATSAPP_TOKEN=EAAxxxx...
   META_PHONE_NUMBER_ID=123456789012345
   META_APP_SECRET=abc123def456...
   META_VERIFY_TOKEN=loop_meta_verify_2026
   ```

**Verify:**
1. Send `verify` from the test number in WhatsApp → should get an auto-reply
2. Send a real message with `30% off` → check `/app/commitments`

**Free:** First 1,000 conversations/month.

---

## 6. Slack (Feature 10)

**What it's for:** Receives Slack messages, runs the same commitment detection pipeline.

**Where to get it:** https://api.slack.com/apps

**Setup (15 min):**
1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: `Loop Demo`, pick your Slack workspace, click **Create App**
3. **Basic Information** (left sidebar):
   - **Signing Secret** → click **Show** → copy → `SLACK_SIGNING_SECRET`
4. **OAuth & Permissions** (left sidebar):
   - **Bot Token Scopes** → add:
     - `chat:write` (post messages)
     - `channels:history`, `groups:history`, `im:history`, `mpim:history` (read messages)
     - `users:read` (resolve names)
   - **Install to Workspace** → confirm → copy **Bot User OAuth Token** (starts with `xoxb-`) → `SLACK_BOT_TOKEN`
5. **Event Subscriptions** (left sidebar):
   - Toggle **Enable Events** ON
   - **Request URL**: `https://YOUR_TUNNEL/api/inbound/slack` — Slack will auto-verify (challenge handshake)
   - **Subscribe to bot events** → add: `message.channels`, `message.groups`, `message.im`, `message.mpim`
   - Click **Save Changes**
6. **Socket Mode** (optional — only if you want Bolt SDK persistent connection):
   - Toggle ON → **Generate Token** → scope `connections:write` → name `loop-socket` → copy (starts with `xapp-`) → `SLACK_APP_TOKEN`
   - Set `SLACK_MODE=socket` in env
7. Add to `.env.local`:
   ```bash
   SLACK_SIGNING_SECRET=a1b2c3d4e5f6...
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_MODE=webhook   # or "socket" if you generated an App Token
   ```

**Verify:**
1. Invite `@Loop Demo` to a channel
2. Post `30% off, ship Friday` → check `/app/commitments` in <1s

**Free:** Unlimited for basic apps.

---

## 7. Cloudflare Email Worker (Feature 9)

**What it's for:** Receives emails sent to `commitments@yourdomain.com` and forwards them to `/api/inbound/email`.

**Where to set it up:** https://dash.cloudflare.com (requires a domain on Cloudflare DNS)

**Setup (15 min):**
1. Sign up at https://dash.cloudflare.com
2. Add your domain (e.g. `yourbrand.com`) — change nameservers at your registrar to Cloudflare's (free)
3. **Email** → **Email Routing** → **Get started** → add the two MX records Cloudflare gives you
4. **Routes** tab → **Create address**:
   - Address: `commitments@yourbrand.com`
   - Action: **Send to a Worker** → **Create new Worker**
5. Worker editor — paste this:
   ```javascript
   export default {
     async email(message, env, ctx) {
       const raw = await message.raw();
       const url = "https://YOUR_TUNNEL/api/inbound/email";
       await fetch(url, {
         method: "POST",
         headers: {
           "Content-Type": "message/rfc822",
           "X-Email-Secret": env.LOOP_SECRET,
         },
         body: raw,
       });
     }
   };
   ```
6. Worker **Settings** → **Variables** → add `LOOP_SECRET` (pick any string, e.g. `loop_email_2026`)
7. **Deploy** the Worker
8. Add the same value to `.env.local`:
   ```bash
   EMAIL_WEBHOOK_SECRET=loop_email_2026
   ```

**Verify:**
Send an email to `commitments@yourbrand.com` with body `30% off, ship Friday` → check `/app/commitments`.

**Free:** Email Routing is free; Workers free tier is 100k requests/day.

**Skip if:** You don't have a domain on Cloudflare DNS.

---

## 8. Inngest (background jobs, already set)

**What it's for:** Triggers long-running work (transcription, flow evaluation) without blocking the webhook response.

**Where to get it:** https://www.inngest.com (already configured for local dev)

**Current setup** (already in `.env.local`):
```bash
INNGEST_API_URL=http://localhost:8288
INNGEST_EVENT_KEY=qxdH9nc3FbRY_3kwvmtey3xR3_I3rlOBIwprILVd1eeIBLSoOV820MB6l0zM7euboW-aHsD3j1m_SXx5SySRZQ
INNGEST_SIGNING_KEY=signkey-prod-ca0e7890c9650a0926b147bfb643176506f62dcde545e0f6d22f214724d4bbd9
```

For production, sign up at https://www.inngest.com and replace the keys.

---

## 9. OpenRouter (already set)

**What it's for:** LLM fallback for harder detection cases.

**Already in `.env.local`:** `OPENROUTER_API_KEY=***`

For your own key, sign up at https://openrouter.ai and create a key.

---

## Order I'd set up for the demo

1. **Cloudflare Tunnel** (named tunnel for stable URLs) — 10 min
2. **Telegram** — 3 min, most impressive single demo
3. **Groq** — 2 min, adds voice (big "wow")
4. **Slack** — 15 min, proves multi-channel
5. **Email** — 15 min, requires domain on Cloudflare
6. **WhatsApp Meta** — 30 min, can skip (Telegram covers the same demo)

**Total setup time for all of them: ~75 min.** Skip the ones you don't need; the rest of the stack works in demo mode.

---

## Verification matrix

After setting keys, this should print `true` for every configured key:

```bash
curl -sS http://localhost:3000/api/health | python3 -c "
import json, sys
h = json.load(sys.stdin)
print('mode:', h['mode'])
print('publicUrl:', h['publicUrl'])
for k, v in h['env'].items():
    print(f'  {k}: {v}')
"
```

Expected output:
```
mode: demo
publicUrl: https://your-tunnel
  supabase: true
  supabaseAnon: true
  groq: true
  telegram: true
  slackSigning: true
  slackBot: true
  emailSecret: true
  ...
```

To switch from demo to live mode, change in `.env.local`:
```bash
FORCE_DEMO_MODE=false   # or remove the line
```

Then restart. The app will start persisting to Supabase automatically.

---

## Already-set keys (don't change these unless you're rotating)

| Variable | Current value (last 4 chars only) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ...egqpk |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ...NC6Fqaw8 |
| `SUPABASE_SERVICE_ROLE_KEY` | ...Pb1IvFAE |
| `LOOP_PUBLIC_URL` | ...stable.trycloudflare.com |
| `INNGEST_API_URL` | ...8288 |
| `INNGEST_EVENT_KEY` | ...SRZQ |
| `INNGEST_SIGNING_KEY` | ...bbd9 |
| `OPENROUTER_API_KEY` | *** |
| `GROQ_API_KEY` | *** |
| `WAPPFLY_API_KEY` | ...0e13 (WhatsApp via Wappfly — older, not used) |
