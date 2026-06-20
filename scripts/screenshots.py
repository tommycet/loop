#!/usr/bin/env python3
"""Take full-page screenshots of each Loop page using Playwright."""
import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
OUT = Path(os.environ.get("OUT", "/root/loop/screenshots"))
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("landing", "/landing"),
    ("docs", "/docs"),
    ("about", "/about"),
    ("pricing", "/pricing"),
    ("contact", "/contact"),
    ("login", "/login"),
    ("signup", "/signup"),
    ("app", "/app"),
]

VIEWPORTS = [
    ("desktop", 1440, 900),
    ("mobile", 390, 844),
]

async def shoot(page, name, path, vw, vh):
    url = f"{BASE}{path}"
    await page.set_viewport_size({"width": vw, "height": vh})
    try:
        await page.goto(url, wait_until="networkidle", timeout=20000)
    except Exception as e:
        # Some pages have long-polling connections; just wait_for_selector instead
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        except Exception as e2:
            print(f"  ✗ {name} ({vw}x{vh}): {e2}")
            return False

    # Wait for fonts + Three.js lazy-mount
    try:
        await page.wait_for_function("document.fonts.ready", timeout=5000)
    except Exception:
        pass
    await page.wait_for_timeout(2500)  # Let WebGL render + animations settle

    file = OUT / f"{name}_{vw}x{vh}.png"
    await page.screenshot(path=str(file), full_page=True)
    size = file.stat().st_size
    print(f"  ✓ {name} ({vw}x{vh}): {size:,} bytes → {file.name}")
    return True

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            color_scheme="dark",
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
        )
        page = await context.new_page()

        for name, path in PAGES:
            print(f"[{name}] {path}")
            for vw_name, vw, vh in VIEWPORTS:
                await shoot(page, name, path, vw, vh)

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())