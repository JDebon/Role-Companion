# Implementation Plan — SPEC-009: World Setting and Lore

**Spec:** [SPEC-009-world-setting-lore.md](./SPEC-009-world-setting-lore.md)
**Status:** Done
**Last Updated:** 2026-03-12

---

## Task Overview

```
T-01 → T-02 → T-03 → T-04
                T-03 → T-05
```

---

## Tasks

### T-01 — Schema: lore_documents
**Depends on:** SPEC-001 T-01
**Status:** [x] Done

- [x] `lore_documents`: id, campaign_id (FK), author_id (FK), title (varchar 200), content (text), is_published (bool, default false), created_at, updated_at.

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [x] Done

- [x] Migration file `0008_lore_documents.sql` created.

---

### T-03 — API routes: lore CRUD + visibility guard
**Depends on:** T-02
**Status:** [x] Done

- [x] `GET /campaigns/:id/lore` — DM sees all; players see only published; supports `?q=`.
- [x] `GET /campaigns/:id/lore/:docId` — DM sees any; player gets 403 for unpublished.
- [x] `POST /campaigns/:id/lore` — DM only; isPublished defaults to false.
- [x] `PATCH /campaigns/:id/lore/:docId` — DM only; partial update (title, content, isPublished).
- [x] `DELETE /campaigns/:id/lore/:docId` — DM only.

---

### T-04 — Register routes in app.ts
**Depends on:** T-03
**Status:** [x] Done

- [x] Import `loreRouter` from `routes/lore.ts`.
- [x] Mount at `/api/v1/campaigns`.

---

### T-05 — Tests
**Depends on:** T-03
**Status:** [x] Done

- [x] Unit: visibility guard (player blocked from unpublished doc).
- [x] Integration: all acceptance criteria from SPEC-009.
