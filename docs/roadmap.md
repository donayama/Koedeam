# Koedeam Roadmap (Pseudo-Issue Based)

## Governance Rule
This file (`docs/roadmap.md`) is the single source of truth for pseudo-issues (Work Items).
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

## WI-102 (implement) Insert Position Indicator [doing]
Display clear insert preview and commit feedback.

## WI-103 (implement) Settings Layout Fix [todo]
Fix wrapping/overflow in settings dialog.

## WI-104 (implement) Settings Reclassification [todo]
Reorganize settings into:
- Voice
- Display
- Edit
- Template
- Share
- Other

---

# EPIC-1.5: VoiceEngine Abstraction

## WI-150 (prepare) handleVoiceEvent Aggregation [doing]
Centralize all voice event handling.

## WI-151 (implement) VoiceEngine Interface + RealVoiceEngine [doing]

## WI-152 (prepare) testMode Switch Skeleton [doing]

---

# EPIC-3: Field Test Mode

## WI-301 (implement) Consent + Field Test UI [doing]

## WI-302 (implement) session.json v1.1 (device/os/browser/capabilities/settings/events/metrics) [todo]

## WI-303 (implement) ZIP Export (session/result/commits/meta/CONSENT) [todo]

---

# EPIC-4: Replay & Synthetic

## WI-401 (implement) ReplayVoiceEngine (realtime) [todo]

## WI-420 (prepare→implement) Synthetic Generator (seed-fixed) [todo]

---

# EPIC-5: CI with Playwright

## WI-501 (prepare→implement) Playwright Deterministic Replay Test [todo]

## WI-503 (prepare→implement) GitHub Actions Workflow [todo]
