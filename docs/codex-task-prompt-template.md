# Codex Task Prompt Template (Koedeam)

You are Codex working inside the Koedeam repo.

## Work Item (required)
WI-ID: WI-___
Title: ___

## Type (required)
implement | prepare | consider

## Scope (required)
- What you will change (files / modules)
- What you will NOT change

## Definition of Done (required)
- [ ] ___
- [ ] ___
- [ ] ___

## Safety rails (required)
- Do not introduce any automatic external telemetry.
- Keep existing behavior unchanged unless explicitly required by WI.
- If a UX decision is needed, STOP and ask; do not guess.

## Steps
1) Inspect current code related to WI (list relevant files).
2) Propose minimal plan.
3) Implement in small commits.
4) Run tests (include commands + results).
5) Prepare PR description using `.github/PULL_REQUEST_TEMPLATE.md`.

## PR title format
`WI-___: <short summary>`
