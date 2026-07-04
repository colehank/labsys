---
name: add-backend-feature-with-model-and-api
description: Workflow command scaffold for add-backend-feature-with-model-and-api in labsys.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-backend-feature-with-model-and-api

Use this workflow when working on **add-backend-feature-with-model-and-api** in `labsys`.

## Goal

Adds a new backend feature that includes a new data model, database migration, API endpoint, and service logic.

## Common Files

- `backend/alembic/versions/*.py`
- `backend/app/models/*.py`
- `backend/app/models/__init__.py`
- `backend/app/domains/*/service.py`
- `backend/app/domains/*/router.py`
- `backend/app/main.py`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new model file in backend/app/models/
- Update backend/app/models/__init__.py to include the new model
- Create Alembic migration script in backend/alembic/versions/
- Implement service logic in backend/app/domains/<feature>/service.py
- Implement API router in backend/app/domains/<feature>/router.py

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.