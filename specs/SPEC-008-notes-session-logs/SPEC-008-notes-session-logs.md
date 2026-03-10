# Spec: Notes & Session Logs

**Spec ID:** SPEC-008
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers note-taking and session logging within a campaign. Players can write private notes scoped to their character. The DM writes session summaries and can selectively reveal notes to the whole party. Both types support rich text.

### 1.2 Problem Statement

Campaigns span many sessions over months or years. Without a shared record, players forget plot details, lose track of quest leads, and the DM has no structured place to summarize what happened. This spec gives every participant a place to write, and gives the DM the power to control what is shared with the party.

### 1.3 Goals

- [ ] Allow any campaign member to write private notes attached to their character.
- [ ] Allow the DM to write session summaries visible to the whole party.
- [ ] Allow the DM to create notes and selectively reveal them to the party.
- [ ] Allow members to search their notes by keyword.

### 1.4 Non-Goals

- Image or file attachments.
- Collaborative real-time editing (SPEC-015).
- World notes (locations, factions — SPEC-013).
- Quest tracking (SPEC-012).

---

## 2. Background & Context

Notes are the only Phase 2 spec with no SRD data dependency. They are purely user-generated content.

**Related Specs:**
- SPEC-001 — auth and campaigns (required, done).
- SPEC-003 — character sheet; character-scoped notes reference `character_id`.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | Any campaign member MUST be able to create a private note attached to their character. |
| FR-002 | MUST     | A note author MUST be able to edit and delete their own notes. |
| FR-003 | MUST     | Notes MUST be private by default — visible only to the author (and the DM). |
| FR-004 | MUST     | The DM MUST be able to create session logs (numbered summaries) visible to all campaign members. |
| FR-005 | MUST     | The DM MUST be able to create a note and later reveal it to the entire party. |
| FR-006 | MUST     | Members MUST be able to list all session logs for their campaign. |
| FR-007 | SHOULD   | Members SHOULD be able to search notes and session logs by keyword. |
| FR-008 | SHOULD   | Notes SHOULD support basic markdown formatting (rendered in the frontend). |
| FR-009 | MAY      | The DM MAY pin a session log as the "last session recap" shown on the campaign dashboard. |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Privacy     | A player MUST NOT be able to read another player's private notes via the API. |
| NFR-002 | Performance | Note list endpoints MUST respond in under 300ms. |
| NFR-003 | Storage     | Note content is stored as plain text (markdown rendered client-side); no HTML stored server-side. |

### 3.3 Constraints

- The DM can read all notes in their campaign (DM fiat).
- Revealed notes become readable by all campaign members and cannot be un-revealed.

---

## 4. User Stories

### US-001: Player Writes a Private Note

**As a** Player,
**I want to** jot down something my character discovered,
**so that** I can reference it later without cluttering the shared session log.

**Acceptance Criteria:**
- [ ] AC-001: Given I write a note titled "Rumor about the mine" with body text, when I submit, then the note is saved and visible only to me (and the DM).
- [ ] AC-002: Given another player calls `GET /characters/:id/notes`, then they receive HTTP 403.
- [ ] AC-003: Given I edit the note's body, when I save, then the updated content is returned.

---

### US-002: DM Writes a Session Log

**As a** Dungeon Master,
**I want to** write a session summary after each session,
**so that** all players can read a recap before the next session.

**Acceptance Criteria:**
- [ ] AC-001: Given I create session log #3 with a title and body, when any campaign member calls `GET /campaigns/:id/session-logs`, then session log #3 appears.
- [ ] AC-002: Given session number 3 already exists, when I try to create another with number 3, then I receive HTTP 409.
- [ ] AC-003: Given I am a player (not DM), when I try to create a session log, then I receive HTTP 403.

---

### US-003: DM Reveals a Note to the Party

**As a** Dungeon Master,
**I want to** share a note I wrote with the entire party,
**so that** everyone sees an important plot reveal at the right moment.

**Acceptance Criteria:**
- [ ] AC-001: Given I created a private DM note, when I reveal it, then all campaign members can see it via `GET /campaigns/:id/notes/revealed`.
- [ ] AC-002: Given a note is revealed, when I try to un-reveal it, then I receive an error (reveal is permanent).

---

## 5. Design

### 5.1 Data Model

```typescript
interface Note {
  id: string;             // UUID
  campaignId: string;     // FK → campaigns.id
  authorId: string;       // FK → users.id
  characterId: string | null; // FK → characters.id (null for DM notes)
  title: string;          // max 200 chars
  content: string;        // markdown text
  isRevealed: boolean;    // if true, all campaign members can read
  createdAt: Date;
  updatedAt: Date;
}

interface SessionLog {
  id: string;             // UUID
  campaignId: string;     // FK → campaigns.id
  authorId: string;       // FK → users.id (must be DM)
  sessionNumber: number;  // positive integer, UNIQUE per campaign
  title: string;          // max 200 chars
  content: string;        // markdown text
  isPinned: boolean;      // shown as "last recap" on dashboard
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 API Design

#### Character Notes

**`GET /api/v1/characters/:id/notes`** _(auth, note author or DM)_
```json
[{ "id": "...", "title": "Rumor about the mine", "createdAt": "...", "updatedAt": "..." }]
```

**`POST /api/v1/characters/:id/notes`** _(auth, character owner)_
```json
// Request
{ "title": "Rumor about the mine", "content": "The innkeeper mentioned a **collapsed shaft**..." }
// Response 201
{ "id": "...", "title": "Rumor about the mine", "isRevealed": false }
```

**`PATCH /api/v1/characters/:id/notes/:noteId`** _(auth, note author)_
```json
// Request (partial)
{ "content": "Updated content..." }
// Response 200
```

**`DELETE /api/v1/characters/:id/notes/:noteId`** _(auth, note author)_
```json
// Response 204
```

#### DM Notes & Reveals

**`GET /api/v1/campaigns/:id/notes/revealed`** _(auth, campaign member)_
```json
[{ "id": "...", "title": "The King's Secret", "content": "...", "isRevealed": true, "createdAt": "..." }]
```

**`POST /api/v1/campaigns/:id/notes`** _(auth, DM)_
```json
// Request
{ "title": "The King's Secret", "content": "The king is a vampire..." }
// Response 201
{ "id": "...", "title": "The King's Secret", "isRevealed": false }
```

**`POST /api/v1/campaigns/:id/notes/:noteId/reveal`** _(auth, DM)_
```json
// Response 200
{ "id": "...", "isRevealed": true }
```

#### Session Logs

**`GET /api/v1/campaigns/:id/session-logs`** _(auth, campaign member)_
```json
[{ "id": "...", "sessionNumber": 3, "title": "The Mine at Midnight", "isPinned": false, "createdAt": "..." }]
```

**`GET /api/v1/campaigns/:id/session-logs/:logId`** _(auth, campaign member)_
```json
{ "id": "...", "sessionNumber": 3, "title": "The Mine at Midnight", "content": "The party descended...", "isPinned": false }
```

**`POST /api/v1/campaigns/:id/session-logs`** _(auth, DM)_
```json
// Request
{ "sessionNumber": 3, "title": "The Mine at Midnight", "content": "The party descended..." }
// Response 201
```

**`PATCH /api/v1/campaigns/:id/session-logs/:logId`** _(auth, DM)_
**`DELETE /api/v1/campaigns/:id/session-logs/:logId`** _(auth, DM)_

**`POST /api/v1/campaigns/:id/session-logs/:logId/pin`** _(auth, DM)_
```json
// Response 200 — unpins any previously pinned log, pins this one
{ "isPinned": true }
```

### 5.3 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Reading another player's private note | `FORBIDDEN` | 403 |
| Duplicate session number | `DUPLICATE_SESSION_NUMBER` | 409 |
| Player creates session log | `FORBIDDEN` | 403 |
| Un-reveal a revealed note | `ALREADY_REVEALED` | 409 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Note visibility logic — player cannot read another's private note.
- [ ] Session number uniqueness — duplicate session number rejected.

### 6.2 Integration Tests

- [ ] Create character note → only author and DM can read.
- [ ] Another player requests note → 403.
- [ ] DM creates note → not in revealed list.
- [ ] DM reveals note → appears in `GET /notes/revealed` for all members.
- [ ] Try to un-reveal → 409.
- [ ] DM creates session log #3 → visible to all members.
- [ ] Duplicate session number → 409.
- [ ] Player creates session log → 403.
- [ ] Pin session log → previous pinned log is unpinned.

---

## 7. Security Considerations

- [ ] Character note visibility is enforced server-side: only the author and the campaign DM may read private notes.
- [ ] Reveal is a one-way operation enforced at the DB level via a check constraint or application guard.
- [ ] Note content is stored as plain text; any HTML in the input is escaped before storage.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `notes`, `session_logs` | SPEC-001 T-01 |
| T-02 | Migration | T-01 |
| T-03 | Character note CRUD + visibility guard | T-02 |
| T-04 | DM note CRUD + reveal endpoint | T-02 |
| T-05 | Session log CRUD + pin endpoint | T-02 |
| T-06 | Keyword search (PostgreSQL `ILIKE`) | T-03–T-05 |
| T-07 | Frontend: Notes tab on character sheet | T-03 |
| T-08 | Frontend: Session log list + detail view | T-05 |
| T-09 | Frontend: DM note panel with reveal button | T-04 |
| T-10 | Unit + integration tests | T-03–T-05 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should players be able to write campaign-level notes (not character-scoped)? | Team | Open | — |
| 2 | Should reveal be reversible? | Team | Open | Current decision: no |
| 3 | Should there be a word limit on note content? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Markdown stored as plain text, rendered client-side | Simpler; avoids server-side sanitization complexity | Server-side HTML rendering |
| 2026-03-09 | Reveal is one-way (permanent) | Simplest UX; avoids confusion about who has seen what | Reversible reveal |
| 2026-03-09 | DM can read all notes | Respects table-top convention; DM needs to manage the game | Strict player privacy |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
