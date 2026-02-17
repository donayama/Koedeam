from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


def wait_voice_off(page, timeout_ms: int = 8000) -> None:
    page.wait_for_function(
        "() => (document.getElementById('statusInput')?.textContent || '').includes('VOICE:OFF')",
        timeout=timeout_ms,
    )


def set_voice_mode(page, value: str) -> None:
    page.click("#btnMenu")
    page.click("button[data-menu='settings']")
    page.wait_for_timeout(80)
    page.evaluate(
        """(mode) => {
          document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
          document.querySelector(`input[name='voiceMode'][value='${mode}']`)?.click();
          document.getElementById('btnCloseSettings')?.click();
        }""",
        value,
    )
    page.wait_for_timeout(80)


def set_replay_events(page, events: List[Dict[str, object]]) -> None:
    page.evaluate(
        """(items) => {
          window.__KOEDEAM_TEST__?.setReplayEvents?.(items);
        }""",
        events,
    )


def run_command_suite(base_url: str, mode: str, trace_path: Path) -> Tuple[Dict[str, object], List[str]]:
    report: Dict[str, object] = {}
    failures: List[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1100, "height": 700})
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = context.new_page()
        url = f"{base_url}?testMode=1&voiceEngine=replay&replayMode={mode}"
        page.goto(url, wait_until="networkidle")

        set_voice_mode(page, "command")

        # 1) edit command
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'LINE1\\nLINE2\\n';
              ta.focus();
              ta.setSelectionRange(7, 7);
            }"""
        )
        set_replay_events(
            page,
            [
                {"type": "start", "atMs": 0},
                {"type": "result", "atMs": 60, "isFinal": True, "text": "行削除", "confidence": 0.9},
                {"type": "end", "atMs": 220},
            ],
        )
        page.click("#btnMic")
        try:
            wait_voice_off(page)
        except PlaywrightTimeoutError as exc:
            failures.append(f"{mode}: command line delete replay did not complete: {exc}")
        command_delete_value = page.evaluate("() => document.getElementById('editor')?.value || ''")
        report["command_delete_line"] = {"value": command_delete_value}
        if command_delete_value != "LINE1\n":
            failures.append(f"{mode}: command line delete mismatch actual='{command_delete_value}'")

        # 2) panel command
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'BASE';
              ta.focus();
              ta.setSelectionRange(4, 4);
            }"""
        )
        set_replay_events(
            page,
            [
                {"type": "start", "atMs": 0},
                {"type": "result", "atMs": 60, "isFinal": True, "text": "検索", "confidence": 0.9},
                {"type": "end", "atMs": 260},
            ],
        )
        page.click("#btnMic")
        page.wait_for_timeout(500)
        command_search_state = page.evaluate(
            """() => ({
              searchOpen: !!document.getElementById('dlgSearch')?.open,
              editorValue: document.getElementById('editor')?.value || '',
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        report["command_open_search"] = command_search_state
        if not command_search_state["searchOpen"]:
            failures.append(f"{mode}: command search did not open dialog")
        if command_search_state["editorValue"] != "BASE":
            failures.append(f"{mode}: command search transcript inserted unexpectedly")
        if "VOICE:OFF" not in command_search_state["statusInput"]:
            failures.append(f"{mode}: command search did not end with VOICE:OFF")
        if command_search_state["searchOpen"]:
            page.click("#btnCloseSearch")
            page.wait_for_timeout(80)

        # 3) mode-exit command
        set_voice_mode(page, "command")
        set_replay_events(
            page,
            [
                {"type": "start", "atMs": 0},
                {"type": "result", "atMs": 60, "isFinal": True, "text": "終わり", "confidence": 0.9},
                {"type": "end", "atMs": 260},
            ],
        )
        page.click("#btnMic")
        page.wait_for_timeout(500)
        command_stop_state = page.evaluate(
            """() => ({
              cursorChecked: !!document.querySelector("input[name='voiceMode'][value='cursor']")?.checked,
              buttonLabel: document.getElementById('btnVoiceMode')?.textContent || ''
            })"""
        )
        report["command_stop_mode"] = command_stop_state
        if not command_stop_state["cursorChecked"] and "カーソル" not in command_stop_state["buttonLabel"]:
            failures.append(f"{mode}: command stop did not leave command mode")

        context.tracing.stop(path=str(trace_path))
        browser.close()
    return report, failures


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
            wait_voice_off(page)
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

    outputs: Dict[str, object] = {}
    failures = []
    for mode in ("realtime", "fast"):
        first = run_case(base_url, fixture, mode, trace_dir / f"{fixture['id']}_{mode}_run1_trace.zip")
        second = run_case(base_url, fixture, mode, trace_dir / f"{fixture['id']}_{mode}_run2_trace.zip")
        command_report, command_failures = run_command_suite(
            base_url,
            mode,
            trace_dir / f"{fixture['id']}_{mode}_command_trace.zip",
        )
        outputs[mode] = {
            "run1": first,
            "run2": second,
            "command": command_report,
        }
        if first != second:
            failures.append(f"{mode}: non-deterministic output run1 != run2")
        if first != expected:
            failures.append(f"{mode}: output mismatch expected='{expected}' actual='{first}'")
        failures.extend(command_failures)

    print("== Playwright Replay Checks ==")
    print(f"Fixture: {fixture_path}")
    print(f"Base URL: {base_url}")
    print(f"Trace Dir: {trace_dir}")
    print(json.dumps(outputs, ensure_ascii=True, indent=2))
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
