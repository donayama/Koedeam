from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


def run_case(base_url: str, fixture: Dict[str, object], mode: str, trace_path: Path) -> str:
    bridge_json = json.dumps({"replayEvents": fixture.get("events", [])}, ensure_ascii=False)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1100, "height": 700})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()
        page.add_init_script(f"window.__KOEDEAM_TEST__ = {bridge_json};")
        url = f"{base_url}?testMode=1&voiceEngine=replay&replayMode={mode}"
        page.goto(url, wait_until="networkidle")
        # Keep replay result deterministic by resetting editor content before playback.
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = '';
              ta.focus();
              ta.setSelectionRange(0, 0);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }"""
        )
        page.click("#btnMic")
        try:
            page.wait_for_function(
                "() => (document.getElementById('statusInput')?.textContent || '').includes('VOICE:OFF')",
                timeout=8000,
            )
        except PlaywrightTimeoutError as exc:
            context.tracing.stop(path=str(trace_path))
            browser.close()
            raise RuntimeError(f"{mode}: replay did not complete: {exc}") from exc
        result = page.evaluate("() => document.getElementById('editor')?.value || ''")
        context.tracing.stop(path=str(trace_path))
        browser.close()
        return str(result)


def run(base_url: str, fixture_path: Path, trace_dir: Path) -> int:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    expected = str(fixture.get("expectedText", ""))
    if not expected:
        print("FAIL: fixture expectedText is missing")
        return 1
    trace_dir.mkdir(parents=True, exist_ok=True)

    outputs = {}
    failures = []
    for mode in ("realtime", "fast"):
        first = run_case(base_url, fixture, mode, trace_dir / f"{fixture['id']}_{mode}_run1_trace.zip")
        second = run_case(base_url, fixture, mode, trace_dir / f"{fixture['id']}_{mode}_run2_trace.zip")
        outputs[mode] = {"run1": first, "run2": second}
        if first != second:
            failures.append(f"{mode}: non-deterministic output run1 != run2")
        if first != expected:
            failures.append(f"{mode}: output mismatch expected='{expected}' actual='{first}'")

    print("== Playwright Replay Checks ==")
    print(f"Fixture: {fixture_path}")
    print(f"Base URL: {base_url}")
    print(f"Trace Dir: {trace_dir}")
    print(json.dumps(outputs, ensure_ascii=False, indent=2))
    if failures:
        print("")
        print("Failures:")
        for item in failures:
            print(f"- {item}")
        return 1
    print("PASS: deterministic replay checks are green")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministic replay checks with Playwright traces")
    parser.add_argument("--url", default="http://localhost:8000/app/", help="App URL to test")
    parser.add_argument(
        "--fixture",
        default="tests/fixtures/quiet_01.events.json",
        help="Replay fixture path",
    )
    parser.add_argument(
        "--trace-dir",
        default="artifacts/traces",
        help="Directory to store Playwright trace zip files",
    )
    args = parser.parse_args()
    return run(args.url, Path(args.fixture), Path(args.trace_dir))


if __name__ == "__main__":
    raise SystemExit(main())
