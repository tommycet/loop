#!/usr/bin/env python3
import json
import sys
import urllib.request

payload = {
    "kind": "message",
    "channel": "manual",
    "content": "Manual webhook test injected from local utility.",
    "status": "pending",
}

req = urllib.request.Request(
    "http://127.0.0.1:3000/api/test/webhook",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(req, timeout=10) as response:
    sys.stdout.write(response.read().decode())
