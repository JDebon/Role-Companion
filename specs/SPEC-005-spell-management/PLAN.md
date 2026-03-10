# Implementation Plan — SPEC-005: Spell Management

**Spec:** [SPEC-005-spell-management.md](./SPEC-005-spell-management.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-03 → T-04
              T-03 → T-05
              T-03 → T-06
T-03–T-06 → T-10
T-04 → T-07
T-05 → T-08
T-06 → T-09
```

---

## Tasks

### T-01 — Schema: character_spells, spell_slots, concentration_tracker
**Depends on:** SPEC-003 T-01
**Status:** [ ] Pending

- [ ] `character_spells`: id, character_id (FK), spell_index (varchar), status (enum: known|prepared), added_at — UNIQUE (character_id, spell_index)
- [ ] `spell_slots`: id, character_id (FK, UNIQUE), l1Total–l9Total, l1Used–l9Used, updated_at
- [ ] `concentration_tracker`: id, character_id (FK, UNIQUE), spell_index (nullable), started_at (nullable), updated_at

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply migration.

---

### T-03 — GET /characters/:id/spells
**Depends on:** T-02, SPEC-002
**Status:** [ ] Pending

- [ ] Return joined spell data from SRD (name, level, school, concentration flag).
- [ ] Include slot state and current concentration in response.

---

### T-04 — POST + DELETE /characters/:id/spells
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] Validate `spellIndex` exists in seeded SRD 2014 data.
- [ ] Return 409 on duplicate.
- [ ] DELETE removes from character_spells.

---

### T-05 — Spell slot endpoints
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `PUT /spell-slots` — set totals (upsert row).
- [ ] `POST /spell-slots/expend` — increment used, validate not over total.
- [ ] `POST /spell-slots/recover` — reset all used to 0.

---

### T-06 — PUT /characters/:id/concentration
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] Accept spellIndex or null.
- [ ] Upsert concentration_tracker row.
- [ ] Validate spell is on character's spell list and is a concentration spell.

---

### T-07 — Frontend: Spells tab
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] List of known/prepared spells with level, school, concentration badge.
- [ ] Add spell modal with search by name.
- [ ] Remove spell button.

---

### T-08 — Frontend: Spell slot tracker
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] Grid of pip-style slot indicators per level.
- [ ] Click to expend; long-rest button to recover all.

---

### T-09 — Frontend: Concentration tracker
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] Badge showing active concentration spell.
- [ ] "End Concentration" button.
- [ ] Warning on new concentration attempt if already concentrating.

---

### T-10 — Tests
**Depends on:** T-03–T-06
**Status:** [ ] Pending

- [ ] Unit: slot expend/recover logic, concentration upsert.
- [ ] Integration: all acceptance criteria from SPEC-005.
