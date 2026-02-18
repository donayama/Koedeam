from __future__ import annotations

import argparse
import json
import tempfile
import time
import zipfile
from pathlib import Path
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
        context = browser.new_context(accept_downloads=True, viewport={"width": 1100, "height": 700})
        page = context.new_page()
        page.add_init_script(SPEECH_STUB)
        page.goto(base_url, wait_until="networkidle")

        # 1) Basic UI presence
        ids = [
            "btnEditTools",
            "editToolsPanel",
            "btnForceReload",
            "btnUpdateApp",
            "btnBrandDocuments",
            "btnSnapshot",
            "btnEditModeNavigation",
            "btnEditModeEdit",
            "btnTimeMenu",
            "timeMenuPanel",
            "btnUndo",
            "btnRedo",
            "undoDepth",
            "btnTelemetryExportJson",
            "btnTelemetryCopyJson",
            "btnFieldTestExportZip",
            "candidateThreshold",
            "candidateNoConfidenceRule",
            "candidateIdleBehavior",
            "candidatePanel",
            "candidateList",
            "btnRangeCutSel",
            "btnRangePasteSel",
        ]
        exists = page.evaluate(
            "(ids) => Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)]))",
            ids,
        )
        report["ui_exists"] = exists
        for key, ok in exists.items():
            if not ok:
                failures.append(f"missing element: {key}")

        # 1.5) Settings category tabs/panels structure
        page.click("#btnMenu")
        page.click("button[data-menu='settings']")
        settings_tabs = page.evaluate(
            """() => {
              const tabs = ["voice", "display", "edit", "templates", "share", "other"];
              const out = {};
              for (const t of tabs) {
                out[t] = {
                  tab: !!document.querySelector(`#dlgSettings .tab-btn[data-tab="${t}"]`),
                  panel: !!document.getElementById(`panelSettings${t.charAt(0).toUpperCase()}${t.slice(1)}`)
                };
              }
              return out;
            }"""
        )
        report["settings_categories"] = settings_tabs
        for tab, state in settings_tabs.items():
            if not state["tab"] or not state["panel"]:
                failures.append(f"settings category: missing tab/panel for {tab}")

        settings_switch = page.evaluate(
            """() => {
              const tabs = ["voice", "display", "edit", "templates", "share", "other"];
              const results = {};
              const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
              for (const t of tabs) {
                const btn = document.querySelector(`#dlgSettings .tab-btn[data-tab="${t}"]`);
                if (btn) btn.click();
                const panelId = `panelSettings${cap(t)}`;
                const panel = document.getElementById(panelId);
                results[t] = {
                  active: !!(panel && panel.classList.contains("active")),
                };
              }
              return results;
            }"""
        )
        report["settings_switch"] = settings_switch
        for tab, state in settings_switch.items():
            if not state["active"]:
                failures.append(f"settings category: tab switch failed for {tab}")

        # 1.6) canOpen suppression while settings dialog is open
        blocked_state = page.evaluate(
            """() => {
              document.getElementById('btnMenu')?.click();
              const menuVisible = !document.getElementById('menuOverlay')?.classList.contains('hidden');
              document.getElementById('btnReplace')?.click();
              document.getElementById('btnBrandDocuments')?.click();
              return {
                menuVisible,
                searchOpen: !!document.getElementById('dlgSearch')?.open,
                sidebarOpen: !!document.body.classList.contains('with-sidebar'),
                documentsVisible: !(document.getElementById('panelDocuments')?.classList.contains('hidden') ?? true),
                settingsOpen: !!document.getElementById('dlgSettings')?.open
              };
            }"""
        )
        report["can_open_suppression"] = blocked_state
        if blocked_state["menuVisible"]:
            failures.append("canOpen: menu opened while settings dialog is active")
        if blocked_state["searchOpen"]:
            failures.append("canOpen: search dialog opened while settings dialog is active")
        if blocked_state["sidebarOpen"] or blocked_state["documentsVisible"]:
            failures.append("canOpen: document list opened while settings dialog is active")

        # 1.7) Settings persistence (save -> reload -> restore)
        page.evaluate(
            """() => {
              const pick = (sel) => document.querySelector(sel)?.click();
              pick("#dlgSettings .tab-btn[data-tab='voice']");
              pick("input[name='voiceContinuous'][value='true']");
              pick("input[name='voiceLang'][value='auto']");
              const tone = document.getElementById('optVoiceStartTone');
              if (tone) { tone.checked = false; tone.dispatchEvent(new Event('change', { bubbles: true })); }

              pick("#dlgSettings .tab-btn[data-tab='display']");
              pick("input[name='fontFace'][value='mono']");
              pick("input[name='editPanelPos'][value='right']");

              pick("#dlgSettings .tab-btn[data-tab='edit']");
              pick("input[name='punctuationMode'][value='en']");
              const th = document.getElementById('candidateThreshold');
              const nc = document.getElementById('candidateNoConfidenceRule');
              const ib = document.getElementById('candidateIdleBehavior');
              const ud = document.getElementById('undoDepth');
              if (th) { th.value = '0.77'; th.dispatchEvent(new Event('change', { bubbles: true })); }
              if (nc) { nc.value = 'direct'; nc.dispatchEvent(new Event('change', { bubbles: true })); }
              if (ib) { ib.value = 'hold'; ib.dispatchEvent(new Event('change', { bubbles: true })); }
              if (ud) { ud.value = '5'; ud.dispatchEvent(new Event('change', { bubbles: true })); }

              const mode = document.querySelector("input[name='templateInsertMode'][value='head']");
              if (mode) { mode.checked = true; mode.dispatchEvent(new Event('change', { bubbles: true })); }
            }"""
        )
        page.click("#btnCloseSettings")
        page.wait_for_timeout(120)
        settings_closed_once = page.evaluate(
            """() => {
              const dlg = document.getElementById('dlgSettings');
              if (!dlg) return false;
              const style = window.getComputedStyle(dlg);
              const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              return !dlg.open && !visible;
            }"""
        )
        report["settings_close_action"] = {"closed": settings_closed_once}
        if not settings_closed_once:
            failures.append("settings close: close button did not close/hide dialog")

        page.click("#btnReplace")
        page.wait_for_timeout(80)
        reopen_check = page.evaluate(
            """() => ({
              settingsOpen: !!document.getElementById('dlgSettings')?.open,
              searchOpen: !!document.getElementById('dlgSearch')?.open
            })"""
        )
        report["settings_reopen_check"] = reopen_check
        if reopen_check["settingsOpen"]:
            failures.append("settings close: dialog reopened unexpectedly after opening other panel")
        if reopen_check["searchOpen"]:
            page.click("#btnCloseSearch")
            page.wait_for_timeout(50)

        page.reload(wait_until="networkidle")
        page.click("#btnMenu")
        page.click("button[data-menu='settings']")
        settings_persist = page.evaluate(
            """() => ({
              voiceContinuous: document.querySelector("input[name='voiceContinuous'][value='true']")?.checked || false,
              voiceLang: document.querySelector("input[name='voiceLang'][value='auto']")?.checked || false,
              voiceStartTone: document.getElementById('optVoiceStartTone')?.checked ?? null,
              fontFaceMono: document.querySelector("input[name='fontFace'][value='mono']")?.checked || false,
              editPanelRight: document.querySelector("input[name='editPanelPos'][value='right']")?.checked || false,
              punctuationEn: document.querySelector("input[name='punctuationMode'][value='en']")?.checked || false,
              candidateThreshold: document.getElementById('candidateThreshold')?.value || '',
              candidateNoConfidenceRule: document.getElementById('candidateNoConfidenceRule')?.value || '',
              candidateIdleBehavior: document.getElementById('candidateIdleBehavior')?.value || '',
              undoDepth: document.getElementById('undoDepth')?.value || ''
            })"""
        )
        report["settings_persistence"] = settings_persist
        if not settings_persist["voiceContinuous"]:
            failures.append("settings persist: voiceContinuous did not restore")
        if not settings_persist["voiceLang"]:
            failures.append("settings persist: voiceLang did not restore")
        if settings_persist["voiceStartTone"] is not False:
            failures.append("settings persist: voiceStartTone did not restore")
        if not settings_persist["fontFaceMono"]:
            failures.append("settings persist: fontFace did not restore")
        if not settings_persist["editPanelRight"]:
            failures.append("settings persist: editPanelPos did not restore")
        if not settings_persist["punctuationEn"]:
            failures.append("settings persist: punctuationMode did not restore")
        if settings_persist["candidateThreshold"] != "0.77":
            failures.append("settings persist: candidateThreshold did not restore")
        if settings_persist["candidateNoConfidenceRule"] != "direct":
            failures.append("settings persist: candidateNoConfidenceRule did not restore")
        if settings_persist["candidateIdleBehavior"] != "hold":
            failures.append("settings persist: candidateIdleBehavior did not restore")
        if settings_persist["undoDepth"] != "5":
            failures.append("settings persist: undoDepth did not restore")
        page.click("#btnCloseSettings")
        page.wait_for_timeout(80)

        template_insert_mode_persist = page.evaluate(
            """() => ({
              templateInsertHead: document.querySelector("input[name='templateInsertMode'][value='head']")?.checked || false
            })"""
        )
        report["template_insert_mode_persistence"] = template_insert_mode_persist
        if not template_insert_mode_persist["templateInsertHead"]:
            failures.append("template insert: mode did not restore")

        # 1.8) Dialog/Panel transition matrix (regression guard)
        transition_matrix = {}

        def ui_state() -> Dict[str, bool]:
            return page.evaluate(
                """() => ({
                  menuOpen: !document.getElementById('menuOverlay')?.classList.contains('hidden'),
                  sidebarOpen: document.body.classList.contains('with-sidebar'),
                  templatesVisible: !(document.getElementById('panelTemplates')?.classList.contains('hidden') ?? true),
                  documentsVisible: !(document.getElementById('panelDocuments')?.classList.contains('hidden') ?? true),
                  historyVisible: !(document.getElementById('panelHistory')?.classList.contains('hidden') ?? true),
                  settingsOpen: !!document.getElementById('dlgSettings')?.open,
                  searchOpen: !!document.getElementById('dlgSearch')?.open,
                  shareOpen: !!document.getElementById('dlgShare')?.open,
                  helpOpen: !!document.getElementById('dlgHelp')?.open
                })"""
            )

        def close_transient() -> None:
            page.evaluate(
                """() => {
                  document.getElementById('btnCloseMenu')?.click();
                  document.getElementById('btnCloseSearch')?.click();
                  document.getElementById('btnCloseShare')?.click();
                  document.getElementById('btnCloseHelp')?.click();
                  document.getElementById('btnCloseSettings')?.click();
                  if (document.body.classList.contains('with-sidebar')) {
                    document.getElementById('btnCloseSidebar')?.click();
                  }
                }"""
            )
            page.wait_for_timeout(120)

        # Case A: Share dialog blocks Search open.
        close_transient()
        page.click("#btnShare")
        page.wait_for_timeout(80)
        page.evaluate("() => document.getElementById('btnReplace')?.click()")
        page.wait_for_timeout(80)
        case_a = ui_state()
        transition_matrix["share_blocks_search"] = case_a
        if not case_a["shareOpen"] or case_a["searchOpen"]:
            failures.append("transition: share/search blocking failed")

        # Case B: Help dialog blocks Menu open.
        close_transient()
        page.click("#btnMenu")
        page.click("button[data-menu='help']")
        page.wait_for_timeout(80)
        page.evaluate("() => document.getElementById('btnMenu')?.click()")
        page.wait_for_timeout(80)
        case_b = ui_state()
        transition_matrix["help_blocks_menu"] = case_b
        if not case_b["helpOpen"] or case_b["menuOpen"]:
            failures.append("transition: help/menu blocking failed")

        # Case C: Sidebar(any) -> Share closes sidebar.
        close_transient()
        page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        page.wait_for_timeout(80)
        page.click("#btnShare")
        page.wait_for_timeout(80)
        case_c = ui_state()
        transition_matrix["share_closes_sidebar"] = case_c
        if not case_c["shareOpen"] or case_c["sidebarOpen"]:
            failures.append("transition: share did not close sidebar")

        # Case D: Sidebar(documents) -> Settings closes sidebar and opens settings.
        close_transient()
        page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        page.wait_for_timeout(80)
        page.click("#btnMenu")
        page.click("button[data-menu='settings']")
        page.wait_for_timeout(80)
        case_d = ui_state()
        transition_matrix["settings_closes_sidebar"] = case_d
        if not case_d["settingsOpen"] or case_d["sidebarOpen"]:
            failures.append("transition: settings did not close sidebar")

        # Case E: Sidebar tabs switch (documents -> history) keeps sidebar and toggles section.
        close_transient()
        page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        page.wait_for_timeout(80)
        page.click("#btnMenu")
        page.click("button[data-menu='snapshot']")
        page.wait_for_timeout(80)
        case_e = ui_state()
        transition_matrix["sidebar_tab_switch"] = case_e
        if not case_e["sidebarOpen"] or not case_e["historyVisible"] or case_e["documentsVisible"]:
            failures.append("transition: sidebar tab switch failed (documents -> history)")

        close_transient()
        report["transition_matrix"] = transition_matrix

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

        # 2.55) Range selection toolbar (cut/paste)
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'HELLO WORLD';
              ta.focus();
              ta.setSelectionRange(6, 11);
            }"""
        )
        page.click("#btnRangeCutSel")
        page.wait_for_timeout(80)
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              const end = ta.value.length;
              ta.setSelectionRange(end, end);
            }"""
        )
        page.click("#btnRangePasteSel")
        page.wait_for_timeout(80)
        range_toolbar_state = page.evaluate("() => ({ value: document.getElementById('editor').value })")
        report["range_toolbar_cut_paste"] = range_toolbar_state
        if range_toolbar_state["value"] != "HELLO WORLD":
            failures.append("range toolbar: cut/paste buttons did not restore expected text")

        # 2.56) Document List action rail layout (desktop: open button stays on right side)
        page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        page.wait_for_timeout(120)
        doc_layout = page.evaluate(
            """() => {
              const row = document.querySelector('#documentsList .doc-item-row');
              const main = row?.querySelector('.doc-main');
              const rail = row?.querySelector('.doc-actions-rail');
              const openBtn = row?.querySelector('button[data-doc-act="open"]');
              if (!row || !main || !rail || !openBtn) {
                return { hasLayout: false, openRight: false, actions: 0, compact: false };
              }
              const mainRect = main.getBoundingClientRect();
              const openRect = openBtn.getBoundingClientRect();
              const rowStyle = window.getComputedStyle(row).gridTemplateColumns || '';
              const actions = rail.querySelectorAll('button[data-doc-act]').length;
              return {
                hasLayout: true,
                openRight: openRect.left >= (mainRect.right - 2),
                actions,
                compact: rowStyle.trim() === '1fr'
              };
            }"""
        )
        report["document_list_layout"] = doc_layout
        if not doc_layout["hasLayout"]:
            failures.append("document list: layout wrappers are missing")
        if doc_layout["actions"] < 2:
            failures.append("document list: open/delete actions are incomplete")
        if doc_layout["compact"]:
            failures.append("document list: desktop layout unexpectedly collapsed")
        if not doc_layout["openRight"]:
            failures.append("document list: open button is not aligned on the right side")
        page.evaluate("() => document.getElementById('btnCloseSidebar')?.click()")
        page.wait_for_timeout(80)

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
              // Ensure 'ABC' is committed as a separate undo snapshot.
            }"""
        )
        page.wait_for_timeout(520)
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.setRangeText('XX', 1, 2, 'select');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }"""
        )
        page.wait_for_timeout(520)
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

        # 2.85) Field Test ZIP export (download + archive content)
        field_zip = {
            "downloaded": False,
            "files": [],
            "has_required_files": False,
            "schema_version": "",
        }
        required_zip_entries = {"session.json", "result.txt", "commits.json", "meta.md", "CONSENT.txt"}
        try:
            page.click("#btnMenu")
            page.click("button[data-menu='settings']")
            page.click("#dlgSettings .tab-btn[data-tab='other']")
            if not page.is_checked("#optFieldTestMode"):
                page.click("#optFieldTestMode")
                if page.locator("#dlgFieldTestConsent").evaluate("e => !!e && e.open"):
                    page.click("#btnFieldTestAgree")
            page.wait_for_timeout(120)
            with page.expect_download(timeout=6000) as dl_info:
                page.click("#btnFieldTestExportZip")
            download = dl_info.value
            field_zip["downloaded"] = True
            with tempfile.TemporaryDirectory() as tmp:
                zip_path = Path(tmp) / "fieldtest.zip"
                download.save_as(str(zip_path))
                with zipfile.ZipFile(zip_path, "r") as zf:
                    names = zf.namelist()
                    field_zip["files"] = sorted(names)
                    field_zip["has_required_files"] = required_zip_entries.issubset(set(names))
                    session = json.loads(zf.read("session.json").decode("utf-8"))
                    field_zip["schema_version"] = str(session.get("schema_version", ""))
            if not field_zip["has_required_files"]:
                failures.append("field test zip: required files are missing")
            if field_zip["schema_version"] != "1.1":
                failures.append("field test zip: session.json schema_version is not 1.1")
            if page.locator("#btnCloseSettings").count():
                page.click("#btnCloseSettings")
        except Exception as exc:
            failures.append(f"field test zip: export check failed ({exc})")
        report["field_test_zip"] = field_zip

        # 2.9) Candidate selection (visibility/fallback/timing)
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

        # no-confidence + show => keep panel visible
        page.evaluate(
            """() => {
              const nc = document.getElementById('candidateNoConfidenceRule');
              const idb = document.getElementById('candidateIdleBehavior');
              if (nc) { nc.value = 'show'; nc.dispatchEvent(new Event('change', { bubbles: true })); }
              if (idb) { idb.value = 'hold'; idb.dispatchEvent(new Event('change', { bubbles: true })); }
            }"""
        )
        page.evaluate("window.__speechMock.emitFinalCandidates([{text:'信頼値なし候補A'},{text:'信頼値なし候補B'}])")
        page.wait_for_timeout(120)
        cand_no_conf_show = page.evaluate(
            """() => ({
              panelVisible: !document.getElementById('candidatePanel').classList.contains('hidden'),
              buttonCount: document.querySelectorAll('#candidateList button[data-candidate-index]').length
            })"""
        )
        report["candidate_no_confidence_show"] = cand_no_conf_show
        if not cand_no_conf_show["panelVisible"] or cand_no_conf_show["buttonCount"] < 2:
            failures.append("candidate: no-confidence(show) did not display panel")
        page.evaluate("""() => document.querySelector('#candidateList button[data-candidate-index="0"]')?.click()""")
        page.wait_for_timeout(80)

        # no-confidence + direct => direct apply, panel hidden
        page.evaluate(
            """() => {
              const nc = document.getElementById('candidateNoConfidenceRule');
              const idb = document.getElementById('candidateIdleBehavior');
              if (nc) { nc.value = 'direct'; nc.dispatchEvent(new Event('change', { bubbles: true })); }
              if (idb) { idb.value = 'hold'; idb.dispatchEvent(new Event('change', { bubbles: true })); }
            }"""
        )
        before_direct = page.evaluate("""() => document.getElementById('editor').value""")
        page.evaluate("window.__speechMock.emitFinalCandidates([{text:'信頼値なし直接採用A'},{text:'信頼値なし直接採用B'}])")
        page.wait_for_timeout(120)
        cand_no_conf_direct = page.evaluate(
            """(beforeText) => ({
              panelHidden: document.getElementById('candidatePanel').classList.contains('hidden'),
              editor: document.getElementById('editor').value,
              changed: document.getElementById('editor').value !== beforeText
            })""",
            before_direct
        )
        report["candidate_no_confidence_direct"] = cand_no_conf_direct
        if not cand_no_conf_direct["panelHidden"]:
            failures.append("candidate: no-confidence(direct) should hide panel")
        if not cand_no_conf_direct["changed"] or "信頼値なし直接採用A" not in cand_no_conf_direct["editor"]:
            failures.append("candidate: no-confidence(direct) did not insert top candidate")

        # auto idle behavior => top candidate auto-applied after delay
        page.evaluate(
            """() => {
              const th = document.getElementById('candidateThreshold');
              const nc = document.getElementById('candidateNoConfidenceRule');
              const idb = document.getElementById('candidateIdleBehavior');
              if (th) { th.value = '0.95'; th.dispatchEvent(new Event('change', { bubbles: true })); }
              if (nc) { nc.value = 'show'; nc.dispatchEvent(new Event('change', { bubbles: true })); }
              if (idb) { idb.value = 'auto'; idb.dispatchEvent(new Event('change', { bubbles: true })); }
            }"""
        )
        auto_before = page.evaluate("""() => document.getElementById('editor').value""")
        auto_started = time.perf_counter()
        page.evaluate("window.__speechMock.emitFinalCandidates([{text:'自動採用第一候補', confidence:0.5},{text:'自動採用第二候補', confidence:0.4}])")
        page.wait_for_function(
            """(beforeText) => {
              const editor = document.getElementById('editor');
              return !!editor && editor.value !== beforeText && editor.value.includes('自動採用第一候補');
            }""",
            arg=auto_before,
            timeout=5000
        )
        auto_elapsed_ms = int((time.perf_counter() - auto_started) * 1000)
        cand_auto_apply = page.evaluate(
            """(elapsedMs) => ({
              elapsedMs,
              panelHidden: document.getElementById('candidatePanel').classList.contains('hidden'),
              editor: document.getElementById('editor').value
            })""",
            auto_elapsed_ms
        )
        report["candidate_auto_apply"] = cand_auto_apply
        if "自動採用第一候補" not in cand_auto_apply["editor"]:
            failures.append("candidate: auto idle did not apply top candidate")
        if not cand_auto_apply["panelHidden"]:
            failures.append("candidate: panel should close after auto idle apply")
        if cand_auto_apply["elapsedMs"] < 2500:
            failures.append("candidate: auto idle applied too early")
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

        voice_counts_before_docs = page.evaluate(
            """() => ({
              startCount: window.__speechMock.startCount,
              stopCount: window.__speechMock.stopCount
            })"""
        )
        page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        page.wait_for_timeout(120)
        voice_on_documents = page.evaluate(
            """() => ({
              stopCount: window.__speechMock.stopCount,
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        report["voice_keep_on_documents"] = voice_on_documents
        if voice_on_documents["stopCount"] != voice_counts_before_docs["stopCount"]:
            failures.append("voice: opening documents sidebar unexpectedly stopped speech")
        if "VOICE:OFF" in voice_on_documents["statusInput"]:
            failures.append("voice: opening documents sidebar moved input to VOICE_OFF unexpectedly")

        page.click("#btnReplace")
        page.wait_for_timeout(120)
        voice_on_search = page.evaluate(
            """() => ({
              stopCount: window.__speechMock.stopCount,
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        report["voice_stop_on_search"] = voice_on_search
        if voice_on_search["stopCount"] <= voice_counts_before_docs["stopCount"]:
            failures.append("voice: opening search dialog should stop speech but did not")
        if "VOICE:OFF" not in voice_on_search["statusInput"]:
            failures.append("voice: input state did not move to VOICE_OFF on search open")
        page.click("#btnCloseSearch")
        page.wait_for_timeout(80)

        page.click("#btnMic")
        page.wait_for_timeout(50)
        aborted_before = page.evaluate("window.__speechMock.startCount")
        page.evaluate("window.__speechMock.emitError('aborted')")
        page.wait_for_timeout(900)
        aborted_state = page.evaluate(
            """() => ({
              startCount: window.__speechMock.startCount
            })"""
        )
        report["voice_restart_on_aborted"] = aborted_state
        if aborted_state["startCount"] <= aborted_before:
            failures.append("voice: aborted did not trigger recovery restart")

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

        # 3.1) Command mode + keyboard selection + voice cut
        page.click("#btnMenu")
        page.click("button[data-menu='settings']")
        page.wait_for_timeout(80)
        page.evaluate(
            """() => {
              document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
              document.querySelector("input[name='voiceMode'][value='command']")?.click();
              document.getElementById('btnCloseSettings')?.click();
            }"""
        )
        page.wait_for_timeout(80)
        page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'KEYCUT';
              ta.focus();
              ta.setSelectionRange(6, 6);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }"""
        )
        page.click("#btnMic")
        page.wait_for_timeout(60)
        page.click("#editor")
        page.wait_for_timeout(30)
        page.keyboard.press("Control+A")
        page.wait_for_timeout(30)
        selection_state = page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              return {
                start: ta.selectionStart,
                end: ta.selectionEnd,
                value: ta.value
              };
            }"""
        )
        page.evaluate("window.__speechMock.emitFinal('削除')")
        page.wait_for_timeout(120)
        cut_state = page.evaluate(
            """() => ({
              value: document.getElementById('editor')?.value || '',
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        report["voice_command_keyboard_cut"] = {
            "selection": selection_state,
            "afterCut": cut_state,
        }
        if selection_state["start"] == selection_state["end"]:
            failures.append("voice command keyboard: keyboard selection did not change during command input")
        if cut_state["value"] != "":
            failures.append("voice command keyboard: voice edit command did not apply after keyboard selection")
        page.click("#btnMic")
        page.wait_for_timeout(50)

        # 3.2) Lifecycle recovery guard: pageshow(persisted) should force VOICE_OFF.
        page.click("#btnMic")
        page.wait_for_timeout(50)
        lifecycle_before = page.evaluate("window.__speechMock.stopCount")
        page.evaluate(
            """() => {
              window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
            }"""
        )
        page.wait_for_timeout(150)
        lifecycle_state = page.evaluate(
            """() => ({
              stopCount: window.__speechMock.stopCount,
              statusInput: document.getElementById('statusInput')?.textContent || '',
              layout: document.getElementById('statusLayout')?.textContent || ''
            })"""
        )
        report["voice_lifecycle_pageshow_stop"] = lifecycle_state
        if lifecycle_state["layout"] == "DESKTOP":
            if "VOICE:OFF" in lifecycle_state["statusInput"]:
                failures.append("voice: desktop lifecycle policy should keep voice running across background")
        else:
            if lifecycle_state["stopCount"] <= lifecycle_before:
                failures.append("voice: pageshow persisted did not stop active speech")
            if "VOICE:OFF" not in lifecycle_state["statusInput"]:
                failures.append("voice: lifecycle guard did not move input state to VOICE_OFF")

        # 3.5) Replay VoiceEngine overlap matrix (pseudo voice engine path)
        replay_report: Dict[str, object] = {}
        replay_context = browser.new_context(accept_downloads=False, viewport={"width": 1100, "height": 700})
        replay_page = replay_context.new_page()
        sep = "&" if "?" in base_url else "?"
        replay_url = f"{base_url}{sep}testMode=1&voiceEngine=replay&replayMode=realtime&synthetic=1&seed=matrix01"
        replay_page.goto(replay_url, wait_until="networkidle")

        replay_page.evaluate(
            """() => {
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 2000, isFinal: true, text: '重畳検証', confidence: 0.9 },
                { type: 'end', atMs: 7000 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(250)

        replay_page.evaluate("() => document.getElementById('btnBrandDocuments')?.click()")
        replay_page.wait_for_timeout(120)
        replay_documents = replay_page.evaluate(
            """() => ({
              statusInput: document.getElementById('statusInput')?.textContent || '',
              sidebarOpen: document.body.classList.contains('with-sidebar')
            })"""
        )
        replay_report["keep_on_documents"] = replay_documents
        if "VOICE:OFF" in replay_documents["statusInput"]:
            failures.append("replay voice: opening documents stopped voice unexpectedly")

        replay_page.click("#btnMenu")
        replay_page.click("button[data-menu='settings']")
        replay_page.wait_for_timeout(120)
        replay_settings = replay_page.evaluate(
            """() => ({
              statusInput: document.getElementById('statusInput')?.textContent || '',
              settingsOpen: !!document.getElementById('dlgSettings')?.open
            })"""
        )
        replay_report["stop_on_settings"] = replay_settings
        if "VOICE:OFF" not in replay_settings["statusInput"]:
            failures.append("replay voice: opening settings did not stop voice")
        if replay_settings["settingsOpen"]:
            replay_page.click("#btnCloseSettings")
            replay_page.wait_for_timeout(80)

        replay_page.evaluate(
            """() => {
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 1500, isFinal: true, text: '検索停止検証', confidence: 0.9 },
                { type: 'end', atMs: 5000 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(250)
        replay_page.click("#btnReplace")
        replay_page.wait_for_timeout(120)
        replay_search = replay_page.evaluate(
            """() => ({
              statusInput: document.getElementById('statusInput')?.textContent || '',
              searchOpen: !!document.getElementById('dlgSearch')?.open
            })"""
        )
        replay_report["stop_on_search"] = replay_search
        if "VOICE:OFF" not in replay_search["statusInput"]:
            failures.append("replay voice: opening search did not stop voice")
        if replay_search["searchOpen"]:
            replay_page.click("#btnCloseSearch")
            replay_page.wait_for_timeout(80)

        # insert pattern overlap using replay result
        replay_page.click("#btnMenu")
        replay_page.click("button[data-menu='settings']")
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
              document.querySelector("input[name='voiceMode'][value='cursor']")?.click();
              document.getElementById('btnCloseSettings')?.click();
            }"""
        )
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'ABCD';
              ta.focus();
              ta.setSelectionRange(2, 2);
            }"""
        )
        replay_page.evaluate(
            """() => {
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 50, isFinal: true, text: 'X', confidence: 0.9 },
                { type: 'end', atMs: 200 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(650)
        cursor_insert_value = replay_page.evaluate("() => document.getElementById('editor').value")
        replay_report["insert_cursor"] = {"value": cursor_insert_value}
        if cursor_insert_value != "ABXCD":
            failures.append("replay voice: cursor insert mode did not insert at caret")

        replay_page.click("#btnMenu")
        replay_page.click("button[data-menu='settings']")
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
              document.querySelector("input[name='voiceMode'][value='append']")?.click();
              document.getElementById('btnCloseSettings')?.click();
            }"""
        )
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'ABCD';
              ta.focus();
              ta.setSelectionRange(1, 1);
            }"""
        )
        replay_page.evaluate(
            """() => {
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 50, isFinal: true, text: 'Y', confidence: 0.9 },
                { type: 'end', atMs: 200 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(650)
        append_insert_value = replay_page.evaluate("() => document.getElementById('editor').value")
        replay_report["insert_append"] = {"value": append_insert_value}
        if not append_insert_value.startswith("ABCD") or "Y" not in append_insert_value:
            failures.append("replay voice: append insert mode did not append at document end")

        # command mode: delete line command should apply edit action
        replay_page.click("#btnMenu")
        replay_page.click("button[data-menu='settings']")
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
              document.querySelector("input[name='voiceMode'][value='command']")?.click();
              document.getElementById('btnCloseSettings')?.click();
            }"""
        )
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'LINE1\\nLINE2\\n';
              ta.focus();
              ta.setSelectionRange(7, 7);
            }"""
        )
        replay_page.evaluate(
            """() => {
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 50, isFinal: true, text: '行削除', confidence: 0.9 },
                { type: 'end', atMs: 200 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(650)
        command_delete_value = replay_page.evaluate("() => document.getElementById('editor').value")
        replay_report["command_delete_line"] = {"value": command_delete_value}
        if command_delete_value != "LINE1\n":
            failures.append("replay command: line delete command did not apply in command mode")

        # command mode: search command should open Search Panel without inserting transcript text
        replay_page.evaluate(
            """() => {
              const ta = document.getElementById('editor');
              ta.value = 'BASE';
              ta.focus();
              ta.setSelectionRange(4, 4);
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 50, isFinal: true, text: '検索', confidence: 0.9 },
                { type: 'end', atMs: 220 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(500)
        command_search_state = replay_page.evaluate(
            """() => ({
              searchOpen: !!document.getElementById('dlgSearch')?.open,
              editorValue: document.getElementById('editor')?.value || '',
              statusInput: document.getElementById('statusInput')?.textContent || ''
            })"""
        )
        replay_report["command_open_search"] = command_search_state
        if not command_search_state["searchOpen"]:
            failures.append("replay command: search command did not open search dialog")
        if command_search_state["editorValue"] != "BASE":
            failures.append("replay command: command transcript was inserted unexpectedly")
        if "VOICE:OFF" not in command_search_state["statusInput"]:
            failures.append("replay command: opening search from command mode did not stop voice")
        if command_search_state["searchOpen"]:
            replay_page.click("#btnCloseSearch")
            replay_page.wait_for_timeout(80)

        # command mode: stop command should switch mode back to cursor
        replay_page.click("#btnMenu")
        replay_page.click("button[data-menu='settings']")
        replay_page.wait_for_timeout(80)
        replay_page.evaluate(
            """() => {
              document.querySelector("#dlgSettings .tab-btn[data-tab='voice']")?.click();
              document.querySelector("input[name='voiceMode'][value='command']")?.click();
              document.getElementById('btnCloseSettings')?.click();
              window.__KOEDEAM_TEST__?.setReplayEvents?.([
                { type: 'start', atMs: 0 },
                { type: 'result', atMs: 50, isFinal: true, text: '終わり', confidence: 0.9 },
                { type: 'end', atMs: 220 }
              ]);
            }"""
        )
        replay_page.click("#btnMic")
        replay_page.wait_for_timeout(500)
        command_stop_state = replay_page.evaluate(
            """() => ({
              cursorChecked: !!document.querySelector("input[name='voiceMode'][value='cursor']")?.checked,
              buttonLabel: document.getElementById('btnVoiceMode')?.textContent || ''
            })"""
        )
        replay_report["command_stop_mode"] = command_stop_state
        if not command_stop_state["cursorChecked"] and "カーソル" not in command_stop_state["buttonLabel"]:
            failures.append("replay command: stop command did not leave command mode")

        report["replay_voice_matrix"] = replay_report
        replay_context.close()

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
    print(f"Settings Categories: {as_bool(all(not f.startswith('settings category:') for f in failures))}")
    print(f"canOpen Suppression: {as_bool(all(not f.startswith('canOpen:') for f in failures))}")
    print(f"Settings Persistence: {as_bool(all(not f.startswith('settings persist:') for f in failures))}")
    print(f"Template Insert Persistence: {as_bool(all(not f.startswith('template insert:') for f in failures))}")
    print(f"Transition Matrix: {as_bool(all(not f.startswith('transition:') for f in failures))}")
    print(f"Keyboard Proxy: {as_bool('keyboard proxy: bottombar did not move with --kb-offset' not in failures and 'keyboard proxy: edit panel did not move with --kb-offset' not in failures)}")
    print(f"Edit Mode Split: {as_bool(all(not f.startswith('edit mode:') for f in failures))}")
    print(f"Document List Layout: {as_bool(all(not f.startswith('document list:') for f in failures))}")
    print(f"Time Menu: {as_bool(all(not f.startswith('time menu:') for f in failures))}")
    print(f"Undo/Redo: {as_bool(all(not f.startswith('undo:') and not f.startswith('redo:') for f in failures))}")
    print(f"Telemetry Export: {as_bool(all(not f.startswith('telemetry:') for f in failures))}")
    print(f"Field Test ZIP: {as_bool(all(not f.startswith('field test zip:') for f in failures))}")
    print(f"Candidate Select: {as_bool(all(not f.startswith('candidate:') for f in failures))}")
    print(f"Voice Recovery: {as_bool(all(not f.startswith('voice:') for f in failures))}")
    print(f"Voice Command Keyboard: {as_bool(all(not f.startswith('voice command keyboard:') for f in failures))}")
    print(f"Replay Voice Matrix: {as_bool(all(not f.startswith('replay voice:') for f in failures))}")
    print(f"Replay Command Mode: {as_bool(all(not f.startswith('replay command:') for f in failures))}")
    print(f"Force Reload Preconditions: {as_bool(all(not f.startswith('force reload precondition') for f in failures))}")
    print("")
    print(json.dumps(report, ensure_ascii=True, indent=2))
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
