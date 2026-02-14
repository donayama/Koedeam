# Koedeam Roadmap (Pseudo-Issue Based)

## Governance Rule
This file (docs/roadmap.md) is the single source of truth for pseudo-issues (Work Items).
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

---
# EPIC-1: Dogfooding Improvements

## WI-101 (implement) New Document Persistence
Ensure new documents are immediately persisted and survive reload.

## WI-102 (implement) Insert Position Indicator
Display clear insert preview and commit feedback.

## WI-103 (implement) Settings Layout Fix
Fix wrapping/overflow in settings dialog.

## WI-104 (implement) Settings Reclassification
Reorganize settings into:
- Voice
- Display
- Edit
- Template
- Share
- Other

---

# EPIC-1.5: VoiceEngine Abstraction

## WI-150 (prepare) handleVoiceEvent Aggregation
Centralize all voice event handling.

## WI-151 (implement) VoiceEngine Interface + RealVoiceEngine

## WI-152 (prepare) testMode Switch Skeleton

---

# EPIC-3: Field Test Mode

## WI-301 (implement) Consent + Field Test UI

## WI-302 (implement) session.json v1.1 (device/os/browser/capabilities/settings/events/metrics)

## WI-303 (implement) ZIP Export (session/result/commits/meta/CONSENT)

---

# EPIC-4: Replay & Synthetic

## WI-401 (implement) ReplayVoiceEngine (realtime)

## WI-420 (prepare→implement) Synthetic Generator (seed-fixed)

---

# EPIC-5: CI with Playwright

## WI-501 (prepare→implement) Playwright Deterministic Replay Test

## WI-503 (prepare→implement) GitHub Actions Workflow

