#!/usr/bin/env python3
"""
Post device status (true/false) to aiwebdesignfirm.com/test.
The /test page shows green for true and red for false.
"""

import urllib.request
import json

# Your site's base URL (use https://aiwebdesignfirm.com when deployed)
BASE_URL = "https://aiwebdesignfirm.com"  # or "http://localhost:3000" for local dev


def post_status(status: bool) -> None:
    """Send device status to the website."""
    url = f"{BASE_URL}/api/device-status"
    data = json.dumps({"status": status}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode())
        print(f"Posted status={status} -> {result}")


if __name__ == "__main__":
    # Example: get status from your device (replace with your real check)
    device_ok = True  # or False
    post_status(device_ok)
