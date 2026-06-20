# Manual channel setup — Telegram, Email, Slack

Test all three inbound channels **without** touching Telegram's @BotFather,
Slack's app dashboard, or Cloudflare's email routing. Everything is driven
from this folder.

## Quick start (3 commands)

```bash
cd /root/loop

# 1. Run all three channels through the live tunnel in one shot
python3 scripts/manual-test/run-all.py --remote

# 2. Check the live dashboard
open https://subaru-herald-exceptional-stable.trycloudflare.com/app/commitments
#   (or /app/admin /app/flows /app/audit)

# 3. Watch the server log
tail -f /tmp/dev_start.log | grep -E "inbound|detection"
```

That's it. The run-all script POSTs a sample message to each of the three
inbound webhooks, the server runs the same `runInlineDetectionDemo()`
pipeline that real Telegram/Slack/Cloudflare messages would trigger, and
commitments appear in the dashboard.

## The three scripts

### 1. `telegram.py` — Telegram Bot API webhook

```bash
# Local dev server, default text
python3 scripts/manual-test/telegram.py

# Through the public tunnel
python3 scripts/manual-test/telegram.py --remote

# With the secret header (only relevant once TELEGRAM_WEBHOOK_SECRET is set)
python3 scripts/manual-test/telegram.py --secret "loop_tg_demo_2026"

# Send a voice message (triggers Feature 2 — Whisper transcription)
python3 scripts/manual-test/telegram.py --voice

# Custom text
python3 scripts/manual-test/telegram.py --text "I can offer 15% off, ship Friday"
```

What it does:
- Builds a real Telegram `Update` payload (text or voice)
- POSTs to `/api/inbound/telegram`
- Without a secret, the route accepts in dev mode (just logs a warning)
- With a secret, the script computes/sends the `X-Telegram-Bot-Api-Secret-Token` header

### 2. `email_test.py` — Cloudflare Email Worker payload

```bash
# Local dev server, default RFC822 + body
python3 scripts/manual-test/email_test.py

# Through the public tunnel
python3 scripts/manual-test/email_test.py --remote

# With the secret header
python3 scripts/manual-test/email_test.py --secret "loop_email_2026"

# Custom sender/subject/body
python3 scripts/manual-test/email_test.py \
  --from "ceo@bigcorp.com" \
  --subject "Quote request" \
  --body "30% off, ship by Friday"
```

What it does:
- Builds a real RFC822 message with From/To/Subject/Date/Message-ID headers
  and a quoted-printable-encoded body
- Wraps it in the JSON envelope `{ from, to, raw }` that Cloudflare Email
  Workers send
- POSTs to `/api/inbound/email`
- Without a secret, the route accepts in dev mode (logs warning)
- With a secret, the script sends the `x-email-secret` header

### 3. `slack.py` — Slack Events API webhook

```bash
# URL verification handshake (no auth, no secret needed)
python3 scripts/manual-test/slack.py --challenge

# Through the public tunnel
python3 scripts/manual-test/slack.py --remote

# With signing secret (computed HMAC over v0:<ts>:<body>)
python3 scripts/manual-test/slack.py --secret "loop_slack_2026"

# Simulate a bot_message (should be silently skipped)
python3 scripts/manual-test/slack.py --secret "loop_slack_2026" --bot

# Custom text
python3 scripts/manual-test/slack.py --secret "loop_slack_2026" \
  --text "30% off, ship Friday, free shipping"
```

What it does:
- Builds a real Slack `event_callback` payload
- If `--secret` is given, computes the `X-Slack-Signature` HMAC-SHA256 over
  `v0:<ts>:<body>` exactly the way Slack does
- POSTs to `/api/inbound/slack`
- Without a secret, the route accepts in dev mode (logs warning)

## Folder layout

```
scripts/manual-test/
├── README.md            ← you are here
├── run-all.py           ← hits all 3 channels, shows commitments after
├── telegram.py          ← Telegram Bot API Update payload
├── email_test.py        ← Cloudflare Email Worker {from,to,raw} envelope
└── slack.py             ← Slack Events API event_callback payload
```

## What happens behind the scenes

1. The script POSTs to the inbound webhook (e.g. `/api/inbound/telegram`).
2. The route:
   - Verifies the secret (or accepts in dev with a warning).
   - Parses the payload using the channel-specific parser
     (`parseTelegramUpdate`, `extractInboundFromEmail`, `parseSlackEventPayload`).
   - Inserts a row into `raw_messages` (or in-memory demo state).
   - Calls `runInlineDetectionDemo()` — the same detector the
     `/api/detect-commitments/[id]` endpoint uses.
3. The detector:
   - Pattern-matches the message against 7 commitment types
     (discount, refund, delivery, payment, complaint, quote, follow-up).
   - Classifies risk tier (low / medium / high / critical).
   - Creates a `commitments` row and an `audit_events` row.
4. The commitment shows up at `/app/commitments` and at `/api/commitments`.

## "What about real setup?"

These scripts are useful for **development and demo** without external
service dependencies. For real production:

| Channel | Real setup |
|---|---|
| Telegram | Create a bot via @BotFather, register the webhook URL via `setWebhook?secret_token=...`, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in `.env.local` |
| Email | Add a domain to Cloudflare, enable Email Routing, point a Worker at `/api/inbound/email` (Worker forwards with `x-email-secret` header), set `EMAIL_WEBHOOK_SECRET` in `.env.local` |
| Slack | Create a Slack app at api.slack.com, enable Event Subscriptions pointing at `/api/inbound/slack`, install to workspace, set `SLACK_SIGNING_SECRET` and `SLACK_BOT_TOKEN` in `.env.local` |

Once the real services are configured, the same webhook URLs work — the
scripts become your "synthetic load test" tools to verify the pipeline
isn't broken before the real service starts sending real events.

## Dev mode vs production

The inbound routes fail-closed by default (no secret = 401). When
`FORCE_DEMO_MODE=true` or `NODE_ENV=development`, the routes accept
unsigned requests and log a warning to stdout:

```
[email-inbound] dev mode: EMAIL_WEBHOOK_SECRET not set, accepting
unauthenticated request. Set the secret in .env.local for production.
[slack-inbound] dev mode: SLACK_SIGNING_SECRET not set, accepting unsigned
request. Set the secret in .env.local for production.
```

This lets you demo the full pipeline without juggling secrets. For
production, remove `FORCE_DEMO_MODE=true` from the env and set all the
secrets in `.env.local`.

## Verifying commitments

After running the scripts, hit any of these:

- **UI**: `https://subaru-herald-exceptional-stable.trycloudflare.com/app/commitments` (gate with `loop-admin`)
- **API**: `curl https://subaru-herald-exceptional-stable.trycloudflare.com/api/commitments?limit=5`
- **Audit**: `https://subaru-herald-exceptional-stable.trycloudflare.com/app/audit`
- **Authority queue**: `https://subaru-herald-exceptional-stable.trycloudflare.com/app/authority`

For full context on what the scripts do, see:

- `src/app/api/inbound/telegram/route.ts` — Telegram route
- `src/app/api/inbound/email/route.ts` — Email route
- `src/app/api/inbound/slack/route.ts` — Slack route
- `src/lib/channels/inline-detect.ts` — shared detection pipeline
- `docs/feature-expansion-strategy.md` — channel integration strategy
