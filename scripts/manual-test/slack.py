#!/usr/bin/env python3
"""
Manual Slack Events API webhook test — POSTs a Slack event_callback payload
to the Loop inbound endpoint with a valid HMAC-SHA256 signature.

USAGE
  # URL verification handshake (no auth needed)
  python3 scripts/manual-test/slack.py --challenge

  # Through the public tunnel
  python3 scripts/manual-test/slack.py --remote --secret "loop_slack_2026"

  # With custom text
  python3 scripts/manual-test/slack.py \\
    --secret "loop_slack_2026" \\
    --text "30% off, delivery by Friday"

  # Simulate a bot_message (should be skipped)
  python3 scripts/manual-test/slack.py --secret "loop_slack_2026" --bot

WHAT IT DOES
  Builds a realistic Slack Events API event_callback payload containing a
  "commitment" phrase, computes the X-Slack-Signature HMAC-SHA256 over
  v0:<ts>:<body> using SLACK_SIGNING_SECRET, then POSTs with the
  X-Slack-Request-Timestamp header.
"""

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request
from urllib.parse import urljoin

DEFAULT_LOCAL = "http://127.0.0.1:3000"
DEFAULT_REMOTE = "https://subaru-herald-exceptional-stable.trycloudflare.com"


def sign(secret: str, ts: str, body: str) -> str:
    base = f"v0:{ts}:{body}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), base, hashlib.sha256).hexdigest()
    return f"v0={digest}"


def build_challenge_payload() -> dict:
    return {
        "token": "legacy-test-token",
        "challenge": "ch_" + hashlib.md5(os.urandom(8)).hexdigest()[:12],
        "type": "url_verification",
    }


def build_message_payload(
    text: str = "30% off, and I'll deliver by Friday",
    user: str = "U07ABCDEF",
    channel: str = "C07XYZ123",
    ts: str = "1718800123.000100",
    is_bot: bool = False,
) -> dict:
    event = {
        "type": "message",
        "user": user,
        "text": text,
        "ts": ts,
        "channel": channel,
        "channel_type": "channel",
    }
    if is_bot:
        event["subtype"] = "bot_message"
        event["bot_id"] = "B07BOT001"
        del event["user"]
    return {
        "token": "legacy-test-token",
        "team_id": "T07TEAM01",
        "api_app_id": "A07APP01",
        "event": event,
        "type": "event_callback",
        "event_id": "Ev07ABCDEF",
        "event_time": int(time.time()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--remote", action="store_true", help="Use the public tunnel")
    ap.add_argument("--base", help="Override base URL")
    ap.add_argument("--secret", help="SLACK_SIGNING_SECRET — required for non-challenge POSTs")
    ap.add_argument("--challenge", action="store_true", help="Send URL verification challenge only")
    ap.add_argument("--text", help="Override the message text")
    ap.add_argument("--bot", action="store_true", help="Simulate a bot_message (should be skipped)")
    args = ap.parse_args()

    base = args.base or (DEFAULT_REMOTE if args.remote else DEFAULT_LOCAL)
    url = urljoin(base.rstrip("/") + "/", "api/inbound/slack")

    if args.challenge:
        payload = build_challenge_payload()
        headers = {"Content-Type": "application/json"}
        body = json.dumps(payload)
        print(f"POST {url} (URL verification handshake)")
        print(f"Headers: {headers}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
    else:
        if not args.secret:
            print("ERROR: --secret is required for non-challenge requests.", file=sys.stderr)
            sys.exit(2)
        text = args.text or "30% off, and I'll deliver by Friday"
        payload = build_message_payload(text=text, is_bot=args.bot)
        body = json.dumps(payload)
        ts = str(int(time.time()))
        sig = sign(args.secret, ts, body)
        headers = {
            "Content-Type": "application/json",
            "X-Slack-Request-Timestamp": ts,
            "X-Slack-Signature": sig,
        }
        print(f"POST {url} (event_callback)")
        print(f"Headers: {list(headers.keys())}")
        print(f"  X-Slack-Request-Timestamp: {ts}")
        print(f"  X-Slack-Signature: {sig[:30]}...")
        print(f"Payload: {json.dumps(payload, indent=2)[:500]}...")

    req = urllib.request.Request(
        url, data=body.encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            response_body = r.read().decode()
            print(f"\n✓ HTTP {r.status}")
            try:
                print(json.dumps(json.loads(response_body), indent=2))
            except Exception:
                print(response_body)
    except urllib.error.HTTPError as e:
        response_body = e.read().decode()
        print(f"\n✗ HTTP {e.code} {e.reason}")
        try:
            print(json.dumps(json.loads(response_body), indent=2))
        except Exception:
            print(response_body)
        if e.code == 401:
            print("\n  Tip: pass --secret to match SLACK_SIGNING_SECRET in .env.local")
        sys.exit(1)


if __name__ == "__main__":
    main()
