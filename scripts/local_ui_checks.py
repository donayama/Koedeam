from __future__ import annotations

import argparse
import json
from typing import Dict, List

from playwright.sync_api import sync_playwright


def as_bool(v: bool) -> str:
    return "PASS" if v else "FAIL"


SPEECH_STUB = r"""
(() => {
  class MockSpeechRecognition {
    constructor() {
      this.lang = 'ja-JP';
      this.interimResults = true;
      this.continuous = false;
      this._listeners = new Map();
      window.__speechMock.instances.push(this);
    }
    addEventListener(type, cb) {
      const arr = this._listeners.get(type) || [];
      arr.push(cb);
      this._listeners.set(type, arr);
    }
    _emit(type, payload = {}) {
      const event = { type, ...payload };
      const arr = this._listeners.get(type) || [];
      arr.forEach((cb) => cb(event));
    }
    start() {
      window.__speechMock.startCount += 1;
      this._emit('start');
    }
    stop() {
      window.__speechMock.stopCount += 1;
      this._emit('end');
    }
  }

  window.__speechMock = {
    instances: [],
    startCount: 0,
    stopCount: 0,
    emitError(error) {
      const rec = this.instances[0];
      if (!rec) return;
      rec._emit('error', { error });
    },
    emitEnd() {
      const rec = this.instances[0];
      if (!rec) return;
      rec._emit('end');
    },
    emitFinal(text) {
      const rec = this.instances[0];
      if (!rec) return;
      rec._emit('result', {
        resultIndex: 0,
        results: [{ 0: { transcript: text, confidence: 0.9 }, isFinal: true, length: 1 }],
      });
    },
    emitFinalCandidates(items) {
      const rec = this.instances[0];
      if (!rec) return;
      const alts = (items || []).map((it) => ({ transcript: it.text, confidence: it.confidence }));
      const arr = { isFinal: true, length: alts.length };
      alts.forEach((a, i) => { arr[i] = a; });
      rec._emit('result', {
        resultIndex: 0,
        results: [arr],
      });
    },
  };

  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
})();
"""


def run(base_url: str) -> int:
    failures: List[str] = []
    report: Dict[str, object] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1100, "height": 700})
        page.add_init_script(SPEECH_STUB)
        page.goto(base_url, wait_until="networkidle")

        # 1) Basic UI presence
        ids = [
            "btnEditTools",
            "editToolsPanel",
            "btnForceReload",
            "btnUpdateApp",
            "btnHeaderDocuments",
            "btnHeaderSnapshot",
            "btnEditModeNavigation",
            "btnEditModeEdit",
            "btnTimeMenu",
            "timeMenuPanel",
            "btnUndo",
            "btnRedo",
            "undoDepth",
            "btnTelemetryExportJson",
            "btnTelemetryCopyJson",
            "candidateThreshold",
            "candidateNoConfidenceRule",
            "candidateIdleBehavior",
            "candidatePanel",
            "candidateList",
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
        try:
            bb = float(str(keyboard_proxy["bottombarBottom"]).replace("px", ""))
            pb = float(str(keyboard_proxy["panelBottom"]).replace("px", ""))
            if bb < 199:
                failures.append("keyboard proxy: bottombar did not move with --kb-offset")
            if pb < 199:
                failures.append("keyboard proxy: edit panel did not move with --kb-offset")
        except Exception:
            failures.append("keyboard proxy: could not parse computed bottom values")


        # 2.5) Edit Panel mode split (Navigation / Edit)
        page.evaluate("""() => document.getElementById('btnEditModeEdit')?.click()""")
        page.wait_for_timeout(50)
        mode_state = page.evaluate(
            """() => ({
              navHidden: document.querySelectorAll('#editToolsPanel [data-edit-mode-group="navigation"].mode-hidden').length,
              navTotal: document.querySelectorAll('#editToolsPanel [data-edit-mode-group="navigation"]').length,
              editVisible: document.querySelectorAll('#editToolsPanel [data-edit-mode-group="edit"]:not(.mode-hidden)').length
            })"""
        )
        report["edit_mode_split"] = mode_state
        if mode_state["navHidden"] != mode_state["navTotal"]:
            failures.append("edit mode: navigation groups are not hidden in edit mode")
        if mode_state["editVisible"] < 1:
            failures.append("edit mode: edit group is not visible in edit mode")

        page.click("#btnEditModeNavigation")
        page.wait_for_timeout(50)
        nav_state = page.evaluate(
            """() => ({
              navVisible: document.querySelectorAll('#editToolsPanel [data-edit-mode-group="navigation"]:not(.mode-hidden)').length,
              editHidden: document.querySelectorAll('#editToolsPanel [data-edit-mode-group="edit"].mode-hidden').length
            })"""
        )
        report["edit_mode_navigation"] = nav_state
        if nav_state["navVisible"] < 1:
            failures.append("edit mode: navigation group is not visible in navigation mode")
        if nav_state["editHidden"] < 1:
            failures.append("edit mode: edit group is not hidden in navigation mode")

        # 2.6) Time menu insert/expand behavior
        page.evaluate("""() => document.getElementById('btnEditModeEdit')?.click()""")
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'A (今日) B';
              ta.focus();
              const pos = ta.value.indexOf('(今日)') + '(今日)'.length;
              ta.setSelectionRange(pos, pos);
            }"""
        )
        page.click("#btnTimeMenu")
        page.click("#timeMenuPanel button[data-time-action='expand-today']")
        time_expand = page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              return { value: ta.value, hasToken: ta.value.includes('(今日)') };
            }"""
        )
        report["time_expand"] = time_expand
        if time_expand["hasToken"]:
            failures.append("time menu: expand-today did not replace token before cursor")

        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = '';
              ta.focus();
              ta.setSelectionRange(0, 0);
            }"""
        )
        page.click("#btnTimeMenu")
        page.click("#timeMenuPanel button[data-time-action='insert-datetime']")
        time_insert = page.evaluate(
            """() => ({ value: document.getElementById('editor').value })"""
        )
        report["time_insert"] = time_insert
        if "(日時)" not in time_insert["value"]:
            failures.append("time menu: insert-datetime did not insert token")

        # 2.75) Undo/Redo restore (including selection)
        page.evaluate("""() => document.getElementById('btnEditModeEdit')?.click()""")
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'ABC';
              ta.focus();
              ta.setSelectionRange(1, 2);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.setRangeText('XX', 1, 2, 'select');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }"""
        )
        page.wait_for_timeout(600)
        page.click("#btnUndo")
        page.wait_for_timeout(80)
        undo_state = page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              return { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd };
            }"""
        )
        report["undo_state"] = undo_state
        if undo_state["value"] != "ABC":
            failures.append("undo: value was not restored")

        page.click("#btnRedo")
        page.wait_for_timeout(80)
        redo_state = page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              return { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd };
            }"""
        )
        report["redo_state"] = redo_state
        if "AXXC" != redo_state["value"]:
            failures.append("redo: value was not restored")

        # 2.8) Telemetry export trigger
        telemetry_export = page.evaluate(
            """() => {
              let called = false;
              const original = URL.createObjectURL;
              URL.createObjectURL = (blob) => {
                called = !!blob;
                return 'blob:koedeam-test';
              };
              const btn = document.getElementById('btnTelemetryExportJson');
              if (btn) btn.click();
              URL.createObjectURL = original;
              return { called };
            }"""
        )
        report["telemetry_export"] = telemetry_export
        if not telemetry_export["called"]:
            failures.append("telemetry: export button did not trigger JSON generation")

        # 2.9) Candidate selection (threshold/no-confidence fallback)
        page.evaluate("""() => document.getElementById('btnEditModeEdit')?.click()""")
        page.wait_for_timeout(50)
        page.evaluate(
            """() => {
              const th = document.getElementById('candidateThreshold');
              const nc = document.getElementById('candidateNoConfidenceRule');
              const idb = document.getElementById('candidateIdleBehavior');
              if (th) { th.value = '0.95'; th.dispatchEvent(new Event('change', { bubbles: true })); }
              if (nc) { nc.value = 'show'; nc.dispatchEvent(new Event('change', { bubbles: true })); }
              if (idb) { idb.value = 'hold'; idb.dispatchEvent(new Event('change', { bubbles: true })); }
            }"""
        )
        page.click("#btnMic")
        page.wait_for_timeout(50)
        page.evaluate("window.__speechMock.emitFinalCandidates([{text:'第一候補', confidence:0.5},{text:'第二候補', confidence:0.4},{text:'第三候補', confidence:0.3}])")
        page.wait_for_timeout(80)
        cand_state = page.evaluate(
            """() => ({
              panelVisible: !document.getElementById('candidatePanel').classList.contains('hidden'),
              buttonCount: document.querySelectorAll('#candidateList button[data-candidate-index]').length
            })"""
        )
        report["candidate_panel"] = cand_state
        if not cand_state["panelVisible"] or cand_state["buttonCount"] < 2:
            failures.append("candidate: panel did not show top alternatives")

        page.evaluate("""() => document.querySelector('#candidateList button[data-candidate-index="1"]')?.click()""")
        page.wait_for_timeout(80)
        cand_apply = page.evaluate("""() => document.getElementById('editor').value""")
        report["candidate_apply"] = cand_apply
        if "第二候補" not in cand_apply:
            failures.append("candidate: selecting #2 did not apply expected text")
        page.click("#btnMic")
        page.wait_for_timeout(50)

        # 3) Voice stabilization regression checks via speech stub
        page.click("#btnMic")
        page.wait_for_timeout(50)
        voice_state = page.evaluate(
            """() => ({
              startCount: window.__speechMock.startCount,
              statusInput: document.getElementById('statusInput')?.textContent || '',
              statusInputTitle: document.getElementById('statusInput')?.title || ''
            })"""
        )
        report["voice_start"] = voice_state
        if voice_state["startCount"] < 1:
            failures.append("voice: mic click did not start speech session")
        if "VOICE:LOCKED" not in voice_state["statusInput"]:
            failures.append("voice: input state did not move to VOICE_LOCKED on start")

        page.evaluate("window.__speechMock.emitEnd()")
        page.wait_for_timeout(900)
        restart_state = page.evaluate(
            """() => ({
              startCount: window.__speechMock.startCount,
              statusInputTitle: document.getElementById('statusInput')?.title || ''
            })"""
        )
        report["voice_restart_on_end"] = restart_state
        if restart_state["startCount"] < 2:
            failures.append("voice: onend did not trigger restart session")

        page.evaluate("window.__speechMock.emitError('no-speech')")
        page.wait_for_timeout(500)
        no_speech_state = page.evaluate("window.__speechMock.startCount")
        report["voice_restart_on_no_speech"] = {"startCount": no_speech_state}
        if no_speech_state < 3:
            failures.append("voice: no-speech did not trigger recovery restart")

        page.click("#btnMic")
        page.wait_for_timeout(50)
        stopped_state = page.evaluate(
            """() => ({
              stopCount: window.__speechMock.stopCount,
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        report["voice_stop"] = stopped_state
        if stopped_state["stopCount"] < 1:
            failures.append("voice: mic second click did not stop session")
        if "VOICE:OFF" not in stopped_state["statusInput"]:
            failures.append("voice: input state did not return to VOICE_OFF on stop")

        # 4) Force reload prerequisites (API availability + cache operable)
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
    print(f"Keyboard Proxy: {as_bool('keyboard proxy: bottombar did not move with --kb-offset' not in failures and 'keyboard proxy: edit panel did not move with --kb-offset' not in failures)}")
    print(f"Edit Mode Split: {as_bool(all(not f.startswith('edit mode:') for f in failures))}")
    print(f"Time Menu: {as_bool(all(not f.startswith('time menu:') for f in failures))}")
    print(f"Undo/Redo: {as_bool(all(not f.startswith('undo:') and not f.startswith('redo:') for f in failures))}")
    print(f"Telemetry Export: {as_bool(all(not f.startswith('telemetry:') for f in failures))}")
    print(f"Candidate Select: {as_bool(all(not f.startswith('candidate:') for f in failures))}")
    print(f"Voice Recovery: {as_bool(all(not f.startswith('voice:') for f in failures))}")
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
