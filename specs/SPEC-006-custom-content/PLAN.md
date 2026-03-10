# Implementation Plan — SPEC-006: Custom Content

**Spec:** [SPEC-006-custom-content.md](./SPEC-006-custom-content.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-04 → T-05 → T-06
                      T-05 → T-07
T-03 ─────────────── T-05
SPEC-002 ──────────── T-06
T-04–T-07 → T-10
T-04 → T-08
T-05, T-07 → T-09
```

---

## Tasks

### T-01 — Schema: custom_entities
**Depends on:** SPEC-001 T-01
**Status:** [ ] Pending

- [ ] `custom_entities`: id, campaign_id (FK), creator_id (FK → users), entity_type (enum: monster|item|rule), name (varchar), base_index (nullable varchar), data (JSONB), created_at, updated_at.

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — Zod schemas for monster / item / rule
**Depends on:** —
**Status:** [ ] Pending

- [ ] Monster schema (mirrors SRD 2014 monster shape, required: name, hit_points, armor_class, challenge_rating).
- [ ] Item schema (required: name, equipment_category).
- [ ] Rule schema (required: name, desc).

---

### T-04 — GET endpoints (list + detail)
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /campaigns/:id/custom-content` with optional `?type=` filter.
- [ ] `GET /campaigns/:id/custom-content/:entityId`.
- [ ] Membership check before returning data.

---

### T-05 — POST /custom-content (create from scratch)
**Depends on:** T-03, T-04
**Status:** [ ] Pending

- [ ] DM-only guard.
- [ ] Validate data against Zod schema for the given entityType.
- [ ] Persist and return created entity.

---

### T-06 — Clone from SRD 2014
**Depends on:** SPEC-002, T-05
**Status:** [ ] Pending

- [ ] Accept `baseIndex` in POST body.
- [ ] Look up base entity in seeded SRD 2014 data.
- [ ] Deep merge base data with provided overrides.
- [ ] Return 404 if base index not found.

---

### T-07 — PATCH + DELETE
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] PATCH: partial update of `name` and/or `data` fields, re-validate Zod.
- [ ] DELETE: DM-only, remove entity from campaign.

---

### T-08 — Frontend: Custom content list page
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Tabbed list (Monsters / Items / Rules).
- [ ] Card per entity with name and type badge.
- [ ] Link to detail view.

---

### T-09 — Frontend: Create/edit form
**Depends on:** T-05, T-07
**Status:** [ ] Pending

- [ ] Dynamic form based on entity type.
- [ ] "Clone from SRD" search to pre-fill from base entity.
- [ ] Edit and delete from detail view (DM only).

---

### T-10 — Tests
**Depends on:** T-03–T-07
**Status:** [ ] Pending

- [ ] Unit: Zod schema validation, SRD merge logic.
- [ ] Integration: all acceptance criteria from SPEC-006.
