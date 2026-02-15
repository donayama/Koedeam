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

## WI-503 (prepare→implement) GitHub Actions Workflow [todo]

## WI-510 (prepare) Audio Fixture Foundation (WAV/MP3 metadata/convert) [done]
- merged to main: `a5b5eb2`

## WI-511 (prepare→implement) Playwright fake-mic WAV input (Chromium optional) [rejected]
- closed without merge: fake-mic WAV path proved unstable for deterministic verification in current environment.
