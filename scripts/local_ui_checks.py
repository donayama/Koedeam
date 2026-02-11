from __future__ import annotations

import argparse
import json
import sys
from typing import Dict, List

from playwright.sync_api import sync_playwright


def as_bool(v: bool) -> str:
    return "PASS" if v else "FAIL"


def run(base_url: str) -> int:
    failures: List[str] = []
    report: Dict[str, object] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1100, "height": 700})
        page.goto(base_url, wait_until="networkidle")

        # 1) Basic UI presence
        ids = [
            "btnEditTools",
            "editToolsPanel",
            "btnForceReload",
            "btnUpdateApp",
            "btnHeaderDocuments",
            "btnHeaderSnapshot",
        ]
        exists = page.evaluate(
            "(ids) => Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)]))",
            ids,
        )
        report["ui_exists"] = exists
        for key, ok in exists.items():
            if not ok:
                failures.append(f"missing element: {key}")

        # 2) Keyboard behavior proxy (non-device simulation)
        page.click("#btnEditTools")
        keyboard_proxy = page.evaluate(
            """() => {
              const panel = document.querySelector('#editToolsPanel');
              panel.classList.remove('pos-top','pos-left','pos-right');
              panel.classList.add('pos-bottom','show');
              document.documentElement.style.setProperty('--kb-offset', '200px');
              document.body.classList.add('keyboard-open');
              const bb = getComputedStyle(document.querySelector('.bottombar')).bottom;
              const pb = getComputedStyle(panel).bottom;
              document.body.classList.remove('keyboard-open');
              return { bottombarBottom: bb, panelBottom: pb };
            }"""
        )
        report["keyboard_proxy"] = keyboard_proxy
        # Expected: bottombar bottom == 200px, panel bottom >= 200px when keyboard-open
        try:
            bb = float(str(keyboard_proxy["bottombarBottom"]).replace("px", ""))
            pb = float(str(keyboard_proxy["panelBottom"]).replace("px", ""))
            if bb < 199:
                failures.append("keyboard proxy: bottombar did not move with --kb-offset")
            if pb < 199:
                failures.append("keyboard proxy: edit panel did not move with --kb-offset")
        except Exception:
            failures.append("keyboard proxy: could not parse computed bottom values")

        # 3) Force reload prerequisites (API availability + cache operable)
        force_reload_pre = page.evaluate(
            """async () => {
              const sw = 'serviceWorker' in navigator;
              const cacheApi = 'caches' in window;
              let cacheWritable = false;
              let cacheKeySeen = false;
              if (cacheApi) {
                const key = 'koedeam-local-check';
                const c = await caches.open(key);
                await c.put('/__koedeam_check__', new Response('ok'));
                const keys = await caches.keys();
                cacheKeySeen = keys.includes(key);
                await caches.delete(key);
                cacheWritable = true;
              }
              return { sw, cacheApi, cacheWritable, cacheKeySeen };
            }"""
        )
        report["force_reload_preconditions"] = force_reload_pre
        if not force_reload_pre["sw"]:
            failures.append("force reload precondition: serviceWorker API missing")
        if not force_reload_pre["cacheApi"]:
            failures.append("force reload precondition: caches API missing")
        if not force_reload_pre["cacheWritable"]:
            failures.append("force reload precondition: cache write test failed")
        if not force_reload_pre["cacheKeySeen"]:
            failures.append("force reload precondition: created cache key not found")

        browser.close()

    print("== Koedeam Local UI Checks ==")
    print(f"Base URL: {base_url}")
    print(f"UI Exists: {as_bool(len([k for k,v in report['ui_exists'].items() if v]) == len(report['ui_exists']))}")
    print(f"Keyboard Proxy: {as_bool('keyboard_proxy: bottombar did not move with --kb-offset' not in failures and 'keyboard proxy: edit panel did not move with --kb-offset' not in failures)}")
    print(f"Force Reload Preconditions: {as_bool(all(not f.startswith('force reload precondition') for f in failures))}")
    print("")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failures:
        print("")
        print("Failures:")
        for f in failures:
            print(f"- {f}")
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Local non-device checks for Koedeam UI behavior")
    parser.add_argument(
        "--url",
        default="http://localhost:8000/app/",
        help="App URL to test (default: http://localhost:8000/app/)",
    )
    args = parser.parse_args()
    return run(args.url)


if __name__ == "__main__":
    raise SystemExit(main())
