#!/usr/bin/env python3
"""
Manual Telegram webhook test — POSTs a realistic Telegram Update payload
to the Loop inbound endpoint and shows the response.

USAGE
  # Local dev server
  python3 scripts/manual-test/telegram.py

  # Or through the public tunnel
  python3 scripts/manual-test/telegram.py --remote

  # Or with the secret header (if TELEGRAM_WEBHOOK_SECRET is set in .env.local)
  python3 scripts/manual-test/telegram.py --secret "loop_tg_demo_2026"

  # Send a voice message
  python3 scripts/manual-test/telegram.py --voice

  # Send a specific message
  python3 scripts/manual-test/telegram.py --text "I will deliver by Friday"
"""

import argparse
import json
import os
import sys
import urllib.request
from urllib.parse import urljoin

DEFAULT_LOCAL = "http://127.0.0.1:3000"
DEFAULT_REMOTE = "https://subaru-herald-exceptional-stable.trycloudflare.com"


def build_text_payload(chat_id: int = 99887766, text: str = "I can offer 20% off, ship Monday"):
    """Realistic Telegram Update payload (text message)."""
    return {
        "update_id": 100000001,
        "message": {
            "message_id": 42,
            "date": 1718800000,
            "chat": {
                "id": chat_id,
                "type": "private",
                "first_name": "Aamir",
                "username": "aamir_karachi",
            },
            "from": {
                "id": chat_id,
                "is_bot": False,
                "first_name": "Aamir",
                "username": "aamir_karachi",
            },
            "text": text,
        },
    }


def build_voice_payload(chat_id: int = 99887766, file_id: str = "AwACAgIAAxkBAAIFileVoice"):
    """Realistic Telegram Update payload (voice message)."""
    return {
        "update_id": 100000002,
        "message": {
            "message_id": 43,
            "date": 1718800060,
            "chat": {
                "id": chat_id,
                "type": "private",
                "first_name": "Aamir",
                "username": "aamir_karachi",
            },
            "from": {
                "id": chat_id,
                "is_bot": False,
                "first_name": "Aamir",
                "username": "aamir_karachi",
            },
            "voice": {
                "file_id": file_id,
                "duration": 12,
                "mime_type": "audio/ogg",
                "file_size": 48000,
            },
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--remote", action="store_true", help="Use the public tunnel")
    ap.add_argument("--base", help="Override base URL")
    ap.add_argument("--secret", help="X-Telegram-Bot-Api-Secret-Token header value")
    ap.add_argument("--voice", action="store_true", help="Send a voice message instead of text")
    ap.add_argument("--text", help="Override the text content")
    args = ap.parse_args()

    base = args.base or (DEFAULT_REMOTE if args.remote else DEFAULT_LOCAL)
    url = urljoin(base.rstrip("/") + "/", "api/inbound/telegram")

    if args.voice:
        payload = build_voice_payload()
    else:
        text = args.text or "I can offer 20% off, ship Monday"
        payload = build_text_payload(text=text)

    headers = {"Content-Type": "application/json"}
    if args.secret:
        headers["X-Telegram-Bot-Api-Secret-Token"] = args.secret

    print(f"POST {url}")
    print(f"Headers: {headers}")
    print(f"Payload: {json.dumps(payload, indent=2)[:500]}...")

    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode()
            print(f"\n✓ HTTP {r.status}")
            try:
                print(json.dumps(json.loads(body), indent=2))
            except Exception:
                print(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"\n✗ HTTP {e.code} {e.reason}")
        try:
            print(json.dumps(json.loads(body), indent=2))
        except Exception:
            print(body)
        sys.exit(1)


if __name__ == "__main__":
    main()
