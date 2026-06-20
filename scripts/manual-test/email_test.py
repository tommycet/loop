#!/usr/bin/env python3
"""
Manual Email webhook test — POSTs a raw RFC822 email payload (the format
Cloudflare Email Workers use) to the Loop inbound endpoint.

USAGE
  # Local dev server (will 401 because EMAIL_WEBHOOK_SECRET not set)
  python3 scripts/manual-test/email.py

  # With secret header
  python3 scripts/manual-test/email.py --secret "loop_email_2026"

  # Or through the public tunnel
  python3 scripts/manual-test/email.py --remote --secret "loop_email_2026"

  # Custom sender / subject / body
  python3 scripts/manual-test/email.py \\
    --from "ceo@bigcorp.com" \\
    --subject "Re: discount request" \\
    --body "Sure, 30% off, we'll ship by Friday."

WHAT IT DOES
  Builds a real RFC822 email with From/To/Subject/Date/Message-ID headers
  + a quoted-printable-encoded body containing a "commitment" phrase, then
  POSTs it as a JSON envelope { from, to, raw } (the Cloudflare Email
  Worker convention).
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from email.utils import format_datetime
from urllib.parse import urljoin

DEFAULT_LOCAL = "http://127.0.0.1:3000"
DEFAULT_REMOTE = "https://subaru-herald-exceptional-stable.trycloudflare.com"


def build_rfc822(
    from_addr: str = "ceo@bigcorp.com",
    from_name: str = "Aamir CEO",
    to_addr: str = "commitments@loop-demo.com",
    subject: str = "Re: discount request",
    body: str = "Sure, we can offer 30% off, and we will deliver by Friday.",
) -> str:
    """Build a realistic RFC822 email with a quoted-printable body.

    The body is short enough to fit on one line, so no soft-line-breaks
    are needed. We still set Content-Transfer-Encoding: quoted-printable
    to exercise the decoder path on the server.
    """
    msg_id = f"<{uuid.uuid4()}@bigcorp.com>"
    date = format_datetime(datetime.now(timezone.utc))
    return (
        f"Message-ID: {msg_id}\r\n"
        f"Date: {date}\r\n"
        f"From: {from_name} <{from_addr}>\r\n"
        f"To: {to_addr}\r\n"
        f"Subject: {subject}\r\n"
        f"MIME-Version: 1.0\r\n"
        f"Content-Type: text/plain; charset=utf-8\r\n"
        f"Content-Transfer-Encoding: quoted-printable\r\n"
        f"\r\n"
        f"{body}\r\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--remote", action="store_true", help="Use the public tunnel")
    ap.add_argument("--base", help="Override base URL")
    ap.add_argument("--secret", help="x-email-secret header value")
    ap.add_argument("--from", dest="from_addr", help="From address")
    ap.add_argument("--subject", help="Subject line")
    ap.add_argument("--body", help="Body text")
    args = ap.parse_args()

    base = args.base or (DEFAULT_REMOTE if args.remote else DEFAULT_LOCAL)
    url = urljoin(base.rstrip("/") + "/", "api/inbound/email")

    raw = build_rfc822(
        from_addr=args.from_addr or "ceo@bigcorp.com",
        subject=args.subject or "Re: discount request",
        body=args.body or "Sure, we can offer 30% off, and we will deliver by Friday.",
    )

    payload = {
        "from": "ceo@bigcorp.com",
        "to": "commitments@loop-demo.com",
        "raw": raw,
    }

    headers = {"Content-Type": "application/json"}
    if args.secret:
        headers["x-email-secret"] = args.secret

    print(f"POST {url}")
    print(f"Headers: {headers}")
    print(f"\n--- Raw RFC822 ({len(raw)} bytes) ---")
    print(raw[:600] + ("..." if len(raw) > 600 else ""))
    print(f"\n--- JSON envelope ---")
    print(json.dumps({k: v if k != "raw" else f"<{len(v)} bytes>" for k, v in payload.items()}, indent=2))

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
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
        if e.code == 401:
            print(
                "\n  Tip: pass --secret to match EMAIL_WEBHOOK_SECRET in .env.local"
            )
        sys.exit(1)


if __name__ == "__main__":
    main()
