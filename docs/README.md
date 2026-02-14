# Docs Structure

`docs/` is organized by purpose:

- `roadmaps/`
  - Mid/long-term roadmap documents.
  - `product-roadmap.md` is the single source of truth for pseudo-issues (WI).
- `plans/`
  - Short-term execution plans by domain/topic.
- `qa/`
  - QA notes and validation memos per feature block.
- `specs/`
  - Product/behavior specs (`field test`, `privacy`, `replay`, `session`).
- `prompts/`
  - Codex task/prompt templates and working prompt docs.

## Rule of thumb

- Use `roadmaps/product-roadmap.md` for WI execution status.
- Use `plans/` for near-term implementation plans.
- Use `specs/` for stable feature requirements.
- Use `qa/` for test notes and observed results.
- Use `prompts/` only for agent/task prompt artifacts.
