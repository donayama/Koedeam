# Koedeam Roadmap (Pseudo-Issue Based)

## Governance Rule
This file (`docs/roadmaps/product-roadmap.md`) is the single source of truth for pseudo-issues (Work Items).
All development must reference a WI-ID (Work Item ID) defined in this document.
Every PR must include:
- Implements: WI-xxx
- Type: implement / prepare / consider
- Definition of Done (DoD)
- Test

## Workflow
1. Pick one WI-ID before implementation.
2. Keep one PR mapped to one WI-ID.
3. If WI-ID mapping is wrong, stop and remap before coding.

## Status Legend
- `[todo]`: not started
- `[doing]`: in progress
- `[done]`: completed (merged to main)
- `[rejected]`: intentionally closed without merge

---

# EPIC-0: Process Foundation

## WI-000 (prepare) Pseudo-Issue (WI) Operation Foundation [done]
- README / AGENTS / PR Template / Roadmap guidance aligned
- merged to main: `5d7d932`, `519c0bb`

---

# EPIC-1: Dogfooding Improvements

## WI-101 (implement) New Document Persistence [done]
Ensure new documents are immediately persisted and survive reload.
- merged to main: `cd73e37`

## WI-102 (implement) Insert Position Indicator [done]
Display clear insert preview and commit feedback.
- merged to main: `a7bbf5d`

## WI-103 (implement) Settings Layout Fix [done]
Fix wrapping/overflow in settings dialog.
- merged to main: `0a51330`, `9a1a0f0`, `a876887`

## WI-104 (implement) Settings Reclassification [done]
Reorganize settings into:
- Voice
- Display
- Edit
- Template
- Share
- Other
- merged to main: `955d8b9`

## WI-105 (implement) Settings Dialog Open/Close Stabilization [done]
Stabilize Settings dialog close behavior to avoid intermittent non-close/reopen symptoms.

## WI-106 (implement) Voice Keep-Alive on Non-Blocking Panels [done]
Keep voice input active when opening non-blocking side panels (documents/history/templates) and stop only on blocking contexts like search/settings.
- merged to main: `d445dd8`

## WI-107 (implement) Template Insert Position Option [done]
Allow selecting template insertion target: caret / document head / document tail.
- merged to main: `d445dd8`

## WI-108 (implement) Voice `aborted` Recovery Guard [done]
Recover automatically from non-manual `aborted` voice errors to avoid stuck sessions.
- merged to main: `d445dd8`

## WI-109 (implement) Range Selection Cut/Paste Toolbar [done]
Add Cut/Paste controls to `Edit Panel > Navigation > 範囲選択` for selection workflow continuity.
- merged to main: `717e60c`

## WI-110 (implement) VoiceEngine Overlap Behavior Matrix Test [done]
Use pseudo VoiceEngine (`testMode + replay/synthetic`) to verify overlap behavior across voice input, panel transitions, and insert patterns.
- merged to main: `717e60c`

## WI-111 (implement) Voice Command Mode ("声で編む") [done]
Add a third voice input mode `command` in addition to `append` / `cursor`.
- In `command` mode, execute local dictionary-matched edit commands from recognized speech (e.g. cut/copy/paste/select/delete and open search/template/share panels).
- Keep this local-first: start with direct phrase matching, and keep room for optional future morphological parsing (e.g. kuromoji.js) without changing the UX contract.
- Restrict command scope to on-screen operations only (open panel/dialog only; no destination/template selection automation).
- merged to main: `f1af7c7`, `179c7c8`, `7cb79e0`

## WI-112 (implement) Document List Action Layout Optimization [done][P1]
Improve `Document List` item layout to expand title visibility.
- Keep `Open` action but move it to the right side / compact action area so text preview space increases.
- Preserve per-document operation clarity on mobile and desktop.
- merged to main: `1f32239`

## WI-113 (prepare→implement) Voice Lifecycle Guard + Background Policy Matrix [done][P0]
Stabilize voice state when app lifecycle changes.
- On foreground return, if recognition handle is invalid/missing, sweep stale voice objects/flags and force consistent OFF state.
- Define platform policy matrix: keep background voice on desktop tabs, stop/recover safely on mobile lifecycle transitions.
- merged to main: `ac818ae`

## WI-114 (consider→implement) Snapshot Model Unification with Document List [doing][P1]
Unify snapshot representation into document-centric list model.
- Store/show snapshots in document list flow with explicit snapshot markers.
- Re-evaluate `Snapshot Panel` entry points (Side Bar / menu) to reduce duplicated navigation.
- progress: snapshot marker integration merged (`c675af3`)
- remaining: `Snapshot Panel` entry-point simplification / de-duplication policy

## WI-115 (implement) Template Insert Default Binding in Settings [done][P1]
Expose default template insert target in Settings and reflect it in initial UI state.
- Initial selection must always match saved default setting.
- merged to main: `2dc663e`

## WI-116 (implement) Force Reload Entry in Overflow Menu [done][P2]
Add `Force Reload` operation to `Overflow Menu` for faster recovery operations.
- merged to main: `71cd3ca`

## WI-117 (prepare) Voice Candidate Feature Verification Pack [done][P0]
Audit whether candidate-selection feature behaves as expected under real/replay flows.
- Add explicit checks and pass/fail report items for candidate visibility, apply timing, and fallback behavior.
- merged to main: `6671194`

## WI-118 (prepare) localStorage Capacity Monitor + User Warning [done][P1]
Introduce storage usage monitoring and warning before quota issues.
- Surface near-limit warning and recommended cleanup/export action.
- merged to main: `c044619`

## WI-119 (consider) Document/Snapshot Data Layer Migration Plan (IndexedDB) [todo][P3][pending]
Design migration path from localStorage-only model for scale.
- Define schema, migration timing, rollback policy, and compatibility strategy.
- Current decision: keep this WI pending while UserStorage(localStorage)運用を継続する。

## WI-121 (implement) UserStorage Pre-Quota Threshold Guard [done][P1]
Keep UserStorage(localStorage) as the primary data layer for now, and add pre-quota safeguards.
- Add threshold check before quota overflow and warn users before write failures.
- Scope is guard/notification only; no data-layer migration in this WI.
- merged to main: `c044619`

## WI-120 (implement) Update Banner Version Message [done][P2]
Add release/version message surface tied to update notification.
- Show concise per-version change note when update is available.
- merged to main: `0a93f7a`

### Recommended Processing Order (Dogfooding)
1. WI-114 `[doing][P1]` Snapshot model unification completion
2. WI-304 `[P1]` 方針見直し（音声プライバシー同意導線）
3. WI-503 `[pending]` GitHub Actions Workflow
4. WI-119 `[P3][pending]` IndexedDB migration plan

---

# EPIC-1.5: VoiceEngine Abstraction

## WI-150 (prepare) handleVoiceEvent Aggregation [done]
Centralize all voice event handling.
- merged to main: `b678139`

## WI-151 (implement) VoiceEngine Interface + RealVoiceEngine [done]
- merged to main: `8ac81c6`

## WI-152 (prepare) testMode Switch Skeleton [done]
- merged to main: `27bb3a8`

---

# EPIC-3: Field Test Mode

## WI-301 (implement) Consent + Field Test UI [done]
- merged to main: `ef08ee3`

## WI-302 (implement) session.json v1.1 (device/os/browser/capabilities/settings/events/metrics) [done]
- merged to main: `57ad98a`

## WI-303 (implement) ZIP Export (session/result/commits/meta/CONSENT) [done]
- merged to main: `9ca0c03`, `2671cc4`

## WI-304 (consider→implement) First-Run Voice Privacy Notice + Consent [todo][P1][policy-review]
Add first-run informed notice for voice recognition transparency.
- Clearly explain browser/service dependency and possible external processing path before first voice use.
- Keep consent state locally and allow later re-check from settings/help.

---

# EPIC-4: Replay & Synthetic

## WI-401 (implement) ReplayVoiceEngine (realtime) [done]
- merged to main: `9790b56`

## WI-420 (prepare→implement) Synthetic Generator (seed-fixed) [done]
- merged to main: `1f88de1`

---

# EPIC-5: CI with Playwright

## WI-501 (prepare→implement) Playwright Deterministic Replay Test [done]
- merged to main: `074c521`

## WI-503 (prepare→implement) GitHub Actions Workflow [todo][pending]

## WI-510 (prepare) Audio Fixture Foundation (WAV/MP3 metadata/convert) [done]
- merged to main: `a5b5eb2`

## WI-511 (prepare→implement) Playwright fake-mic WAV input (Chromium optional) [rejected]
- closed without merge: fake-mic WAV path proved unstable for deterministic verification in current environment.
