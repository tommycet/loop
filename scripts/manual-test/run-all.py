#!/usr/bin/env python3
"""
Run all three channel tests in sequence — proves the full pipeline
end-to-end without ever touching Telegram, Slack, or Cloudflare dashboards.

USAGE
  # Local dev server
  python3 scripts/manual-test/run-all.py

  # Through the public tunnel
  python3 scripts/manual-test/run-all.py --remote

  # With secrets (must match what's in .env.local)
  python3 scripts/manual-test/run-all.py \\
    --telegram-secret "loop_tg_demo_2026" \\
    --email-secret "loop_email_2026" \\
    --slack-secret "loop_slack_2026"
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from urllib.parse import urljoin

# Reuse builders/signers from sibling scripts
sys.path.insert(0, os.path.dirname(__file__))
from telegram import build_text_payload
from email_test import build_rfc822
from slack import build_challenge_payload, build_message_payload, sign


DEFAULT_LOCAL = "http://127.0.0.1:3000"
DEFAULT_REMOTE = "https://subaru-herald-exceptional-stable.trycloudflare.com"


def post(url, body, headers):
    req = urllib.request.Request(url, data=body.encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--remote", action="store_true", help="Use the public tunnel")
    ap.add_argument("--base", help="Override base URL")
    ap.add_argument("--telegram-secret", help="X-Telegram-Bot-Api-Secret-Token value")
    ap.add_argument("--email-secret", help="x-email-secret header value")
    ap.add_argument("--slack-secret", help="SLACK_SIGNING_SECRET value")
    args = ap.parse_args()

    base = args.base or (DEFAULT_REMOTE if args.remote else DEFAULT_LOCAL)
    print(f"Base URL: {base}")
    print(f"Run time: {datetime.now(timezone.utc).isoformat()}\n")

    # Health
    print("═══ /api/health ═══")
    status, body = get(urljoin(base, "/api/health"))
    print(f"  HTTP {status}  mode={body.get('mode')}  publicUrl={body.get('publicUrl')}")
    env = body.get("env", {})
    print(f"  supabase={env.get('supabase')}  telegram={env.get('telegram')}  "
          f"slackSigning={env.get('slackSigning')}  emailSecret={env.get('emailSecret')}\n")

    # Telegram
    print("═══ Telegram ═══")
    url = urljoin(base, "/api/inbound/telegram")
    payload = build_text_payload(text="Manual run-all: 25% off, ship Monday")
    headers = {"Content-Type": "application/json"}
    if args.telegram_secret:
        headers["X-Telegram-Bot-Api-Secret-Token"] = args.telegram_secret
    body = json.dumps(payload)
    status, resp = post(url, body, headers)
    print(f"  HTTP {status}  {resp}\n")

    # Email
    print("═══ Email ═══")
    url = urljoin(base, "/api/inbound/email")
    raw = build_rfc822(
        from_addr="ceo@bigcorp.com",
        subject="Re: order",
        body="Manual run-all: sure, 30% off and we will deliver Friday.",
    )
    payload = {"from": "ceo@bigcorp.com", "to": "commitments@loop-demo.com", "raw": raw}
    headers = {"Content-Type": "application/json"}
    if args.email_secret:
        headers["x-email-secret"] = args.email_secret
    body = json.dumps(payload)
    status, resp = post(url, body, headers)
    print(f"  HTTP {status}  {resp}\n")

    # Slack
    print("═══ Slack ═══")
    url = urljoin(base, "/api/inbound/slack")
    text = "Manual run-all: free shipping, 50% off, can do!"
    payload = build_message_payload(text=text)
    body = json.dumps(payload)
    headers = {"Content-Type": "application/json"}
    if args.slack_secret:
        ts = str(int(time.time()))
        sig = sign(args.slack_secret, ts, body)
        headers["X-Slack-Request-Timestamp"] = ts
        headers["X-Slack-Signature"] = sig
    status, resp = post(url, body, headers)
    print(f"  HTTP {status}  {resp}\n")

    # Verify commitments
    print("═══ Commitments after run ═══")
    status, resp = get(urljoin(base, "/api/commitments?limit=5"))
    items = resp if isinstance(resp, list) else (resp.get("items") or resp.get("commitments") or [])
    print(f"  HTTP {status}  total={len(items)}")
    for c in items[:5]:
        text = c.get("extracted_text") or c.get("text") or c.get("content") or ""
        typ = c.get("type") or "?"
        risk = c.get("risk_tier") or c.get("risk") or "?"
        role = c.get("required_role") or "?"
        # raw_message_id looks like "msg-<channel>-..."; pull the channel segment
        rmid = c.get("raw_message_id") or ""
        parts = rmid.split("-")
        ch = parts[1] if len(parts) >= 2 else "?"
        print(f"    [{ch:>9}] type={typ:<18} risk={risk:<6} needs={role:<10} text={text[:70]}")


if __name__ == "__main__":
    main()
