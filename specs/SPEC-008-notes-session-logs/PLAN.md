# Implementation Plan — SPEC-008: Notes & Session Logs

**Spec:** [SPEC-008-notes-session-logs.md](./SPEC-008-notes-session-logs.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-03 → T-07
              T-04 → T-09
              T-05 → T-08
T-03, T-04, T-05 → T-06
T-03–T-05 → T-10
```

---

## Tasks

### T-01 — Schema: notes, session_logs
**Depends on:** SPEC-001 T-01
**Status:** [ ] Pending

- [ ] `notes`: id, campaign_id (FK), author_id (FK), character_id (nullable FK), title (varchar 200), content (text), is_revealed (bool, default false), created_at, updated_at.
- [ ] `session_logs`: id, campaign_id (FK), author_id (FK), session_number (int), title (varchar 200), content (text), is_pinned (bool, default false), created_at, updated_at.
- [ ] UNIQUE constraint on (campaign_id, session_number).

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — Character note CRUD + visibility guard
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /characters/:id/notes` — only author or DM; returns list without content.
- [ ] `GET /characters/:id/notes/:noteId` — author or DM only.
- [ ] `POST /characters/:id/notes` — character owner only.
- [ ] `PATCH /characters/:id/notes/:noteId` — author only.
- [ ] `DELETE /characters/:id/notes/:noteId` — author only.

---

### T-04 — DM notes + reveal endpoint
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `POST /campaigns/:id/notes` — DM only, character_id = null.
- [ ] `GET /campaigns/:id/notes/revealed` — all members; returns notes where is_revealed = true.
- [ ] `POST /campaigns/:id/notes/:noteId/reveal` — DM only; set is_revealed = true; reject if already true (409).

---

### T-05 — Session log CRUD + pin endpoint
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /campaigns/:id/session-logs` — all members; sorted by session_number descending.
- [ ] `GET /campaigns/:id/session-logs/:logId` — all members; full content.
- [ ] `POST /campaigns/:id/session-logs` — DM only; reject duplicate session_number (409).
- [ ] `PATCH /campaigns/:id/session-logs/:logId` — DM only.
- [ ] `DELETE /campaigns/:id/session-logs/:logId` — DM only.
- [ ] `POST /campaigns/:id/session-logs/:logId/pin` — DM only; unpin all others, pin this one.

---

### T-06 — Keyword search
**Depends on:** T-03, T-04, T-05
**Status:** [ ] Pending

- [ ] Add `?q=` query param to note list and session log list endpoints.
- [ ] Implement with `ILIKE %q%` on title + content (PostgreSQL).

---

### T-07 — Frontend: Notes tab on character sheet
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] List of notes (title + date).
- [ ] Click to expand full content (rendered markdown).
- [ ] New note form.
- [ ] Edit and delete from note detail.

---

### T-08 — Frontend: Session log list + detail
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] Campaign sub-page: list of session logs sorted by number descending.
- [ ] Pinned log shown at top as "Last Session Recap".
- [ ] Detail view with rendered markdown content.
- [ ] DM: create, edit, delete, pin controls.

---

### T-09 — Frontend: DM note panel with reveal button
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] DM-only panel listing campaign-scoped notes.
- [ ] Each note shows title, revealed status, and "Reveal to Party" button.
- [ ] Revealed notes also appear in the shared notes feed for all members.

---

### T-10 — Tests
**Depends on:** T-03–T-05
**Status:** [ ] Pending

- [ ] Unit: visibility guard logic, duplicate session number rejection.
- [ ] Integration: all acceptance criteria from SPEC-008.
