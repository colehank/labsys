---
name: add-frontend-screen-or-tab
description: Workflow command scaffold for add-frontend-screen-or-tab in labsys.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-frontend-screen-or-tab

Use this workflow when working on **add-frontend-screen-or-tab** in `labsys`.

## Goal

Adds a new frontend screen or tab, often for a new feature or entity, and wires it up to API and navigation.

## Common Files

- `frontend/src/screens/*.tsx`
- `frontend/src/api/hooks.ts`
- `frontend/src/api/schema.ts`
- `frontend/src/api/openapi.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update screen component in frontend/src/screens/
- Update API hooks in frontend/src/api/hooks.ts
- Update or regenerate API schema in frontend/src/api/schema.ts and openapi.json
- Wire up navigation or tabs in existing screens

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.