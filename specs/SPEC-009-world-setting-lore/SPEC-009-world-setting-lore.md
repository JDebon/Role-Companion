# Spec: World Setting and Lore

**Spec ID:** SPEC-009
**Status:** Approved
**Created:** 2026-03-12
**Last Updated:** 2026-03-12
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers world-building lore documents within a campaign. The DM creates markdown-formatted documents (locations, factions, history, rules, etc.) and controls which documents are visible to players. Players can browse published lore while unpublished documents remain DM-only.

### 1.2 Problem Statement

Campaigns have rich world-building content — locations, factions, lore, custom rules — that the DM wants to share selectively with players. Without a central lore repository, DMs paste content into chat, share PDFs out-of-band, or repeat themselves each session. This spec gives the DM a structured in-app library to author and selectively reveal world content.

### 1.3 Goals

- [x] Allow the DM to create, edit, and delete lore documents (markdown content).
- [x] Allow the DM to publish/unpublish documents to control player visibility.
- [x] Allow all campaign members to read published documents.
- [x] Allow keyword search across lore documents.
- [x] Allow DM to list all documents (published + unpublished); players see only published.

### 1.4 Non-Goals

- File upload (PDF, Docx, .txt) — deferred to a future iteration.
- Section-level visibility control within a single document — deferred.
- Real-time collaborative editing (SPEC-016).
- @ character mentions resolved server-side — mentions are stored as markdown text, resolved client-side.

---

## 2. Background & Context

Lore documents are campaign-scoped. They complement the existing notes (SPEC-008) and DM tools (SPEC-007) by providing a structured knowledge base rather than session-specific notes.

**Related Specs:**
- SPEC-001 — auth and campaigns (required, done).
- SPEC-008 — Notes & Session Logs; lore documents are a separate concept (not character-scoped, not session-scoped).
- SPEC-013 — World Notes (planned); may overlap in future; this spec covers the core CRUD and visibility layer.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | The DM MUST be able to create a lore document with a title and markdown content. |
| FR-002 | MUST     | The DM MUST be able to edit and delete their lore documents. |
| FR-003 | MUST     | Lore documents MUST be unpublished (DM-only) by default. |
| FR-004 | MUST     | The DM MUST be able to publish a document to make it visible to all campaign members. |
| FR-005 | MUST     | The DM MUST be able to unpublish a document to hide it from players. |
| FR-006 | MUST     | Campaign members MUST be able to list all published lore documents. |
| FR-007 | MUST     | Campaign members MUST be able to read the full content of a published document. |
| FR-008 | MUST     | The DM MUST be able to list all lore documents (published and unpublished). |
| FR-009 | SHOULD   | Members SHOULD be able to search lore documents by keyword (`?q=`). |
| FR-010 | MAY      | Documents MAY include @ mentions of character names (plain markdown text; not server-resolved). |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Privacy     | Unpublished documents MUST NOT be readable by players via the API. |
| NFR-002 | Performance | List and detail endpoints MUST respond in under 300ms. |
| NFR-003 | Storage     | Document content is stored as plain text (markdown rendered client-side). |

### 3.3 Constraints

- Only the campaign DM can create, edit, delete, publish, or unpublish lore documents.
- Unlike notes (SPEC-008), publish/unpublish is reversible — the DM can hide a document after revealing it.

---

## 4. User Stories

### US-001: DM Authors a Lore Document

**As a** Dungeon Master,
**I want to** write a lore document describing the history of the kingdom,
**so that** I can share it with players at the right moment.

**Acceptance Criteria:**
- [x] AC-001: Given I create a document titled "History of Eldoria" with body text, when I submit, the document is saved with `isPublished = false`.
- [x] AC-002: Given I am a player, when I call `GET /campaigns/:id/lore`, the unpublished document does not appear.
- [x] AC-003: Given I am a player, when I call `GET /campaigns/:id/lore/:docId` for an unpublished doc, I receive HTTP 403.

---

### US-002: DM Publishes a Lore Document

**As a** Dungeon Master,
**I want to** publish a lore document so players can read it in-app,
**so that** I don't have to share it out-of-band.

**Acceptance Criteria:**
- [x] AC-001: Given I call `PATCH /campaigns/:id/lore/:docId` with `{ "isPublished": true }`, the document becomes visible to all members.
- [x] AC-002: Given the document is published, when any campaign member calls `GET /campaigns/:id/lore`, it appears in the list.
- [x] AC-003: Given the document is published, when I set `isPublished: false`, players can no longer see it.

---

### US-003: Player Browses Lore

**As a** Player,
**I want to** browse published lore documents for the campaign,
**so that** I can reference world details without asking the DM repeatedly.

**Acceptance Criteria:**
- [x] AC-001: Given there are 3 published documents, when I call `GET /campaigns/:id/lore`, I receive all 3.
- [x] AC-002: Given I call `GET /campaigns/:id/lore/:docId`, I receive the full markdown content.
- [x] AC-003: Given I search `?q=dragon`, I receive only documents whose title or content contains "dragon".

---

## 5. Design

### 5.1 Data Model

```typescript
interface LoreDocument {
  id: string;           // UUID
  campaignId: string;   // FK → campaigns.id
  authorId: string;     // FK → users.id (must be DM)
  title: string;        // max 200 chars
  content: string;      // markdown text
  isPublished: boolean; // false = DM-only, true = all members
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 API Design

**`GET /api/v1/campaigns/:id/lore`** _(auth, campaign member)_
- DM: returns all documents (published + unpublished).
- Player: returns only published documents.
- Supports `?q=` keyword search (ILIKE on title + content).

```json
[{ "id": "...", "title": "History of Eldoria", "isPublished": true, "createdAt": "...", "updatedAt": "..." }]
```

**`GET /api/v1/campaigns/:id/lore/:docId`** _(auth, campaign member)_
- DM: can read any document.
- Player: 403 if document is not published.

```json
{ "id": "...", "title": "History of Eldoria", "content": "Long ago...", "isPublished": true }
```

**`POST /api/v1/campaigns/:id/lore`** _(auth, DM)_
```json
// Request
{ "title": "History of Eldoria", "content": "Long ago..." }
// Response 201
{ "id": "...", "title": "History of Eldoria", "isPublished": false }
```

**`PATCH /api/v1/campaigns/:id/lore/:docId`** _(auth, DM)_
```json
// Request (partial — any combination of fields)
{ "title": "Updated title", "content": "New content...", "isPublished": true }
// Response 200
```

**`DELETE /api/v1/campaigns/:id/lore/:docId`** _(auth, DM)_
```json
// Response 204
```

### 5.3 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Player reads unpublished document | `FORBIDDEN` | 403 |
| Player creates/edits/deletes document | `FORBIDDEN` | 403 |
| Document not found | `NOT_FOUND` | 404 |
| Non-member accesses campaign lore | `NOT_FOUND` | 404 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Visibility guard — player cannot read unpublished documents.
- [ ] Player cannot create/edit/delete documents.

### 6.2 Integration Tests

- [ ] DM creates document → player list returns 0 (unpublished).
- [ ] DM publishes document → player list returns 1.
- [ ] DM unpublishes document → player list returns 0 again.
- [ ] Player reads unpublished document by ID → 403.
- [ ] Player reads published document by ID → 200 with content.
- [ ] DM edits document → updated content returned.
- [ ] DM deletes document → 204; subsequent list returns 0.
- [ ] Keyword search `?q=` filters by title and content.
- [ ] Non-member cannot access lore → 404.
- [ ] Unauthenticated request → 401.

### 6.3 Edge Cases

- [ ] Empty title or content rejected (400).
- [ ] Document from different campaign not accessible.
- [ ] DM in campaign A cannot access campaign B's lore.

---

## 7. Security Considerations

- [ ] Unpublished document visibility is enforced server-side; only the campaign DM may read them.
- [ ] Only the campaign DM may create, edit, delete, publish, or unpublish documents.
- [ ] Document content is stored as plain text; no server-side HTML rendering.
- [ ] Campaign membership is verified on every request.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `lore_documents` table | SPEC-001 T-01 |
| T-02 | Migration: `0008_lore_documents.sql` | T-01 |
| T-03 | API routes: CRUD + visibility guard (`lore.ts`) | T-02 |
| T-04 | Register routes in `app.ts` | T-03 |
| T-05 | Unit + integration tests (`lore.test.ts`) | T-03 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should publish/unpublish be a separate endpoint or part of PATCH? | Team | Resolved | Part of PATCH for simplicity |
| 2 | Should document ordering be configurable (sort order field)? | Team | Open | — |
| 3 | When should section-level visibility be tackled? | Team | Open | Future iteration |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-12 | Publish/unpublish is reversible (unlike note reveal) | World lore evolves; DM should be able to hide spoilers again | One-way like note reveal |
| 2026-03-12 | No file upload in V1 | Requires storage backend (S3/local); markdown is sufficient for launch | File upload from day 1 |
| 2026-03-12 | Single visibility flag (isPublished) not per-player | Simplest model; per-player lore can be emulated via notes (SPEC-008) | Per-player visibility map |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-12 | RoleCompanion Team | Initial spec and implementation |
