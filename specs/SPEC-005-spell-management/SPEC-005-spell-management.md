# Spec: Spell Management

**Spec ID:** SPEC-005
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers how a character tracks spells: which spells they know or have prepared, how many spell slots they have per level, and whether they are currently concentrating on a spell.

### 1.2 Problem Statement

Spellcasting is one of the most complex parts of D&D 5e (2014). A character may know or prepare spells from the SRD spell list, spend spell slots to cast them, upcast spells into higher slots, and maintain concentration on ongoing spells. Without this system, spellcasting characters have no way to track their magical resources during a session.

### 1.3 Goals

- [ ] Let a player add known/prepared spells to their character from the SRD 2014 spell list.
- [ ] Track spell slots per level (1–9), including how many have been used.
- [ ] Track concentration — only one concentration spell active at a time.
- [ ] Allow spell slot recovery on short/long rest (handled in SPEC-011).
- [ ] Allow the DM and player to view a character's spell state.

### 1.4 Non-Goals

- Full compendium search of spells (SPEC-002).
- Custom spells (SPEC-006).
- Rest-based slot recovery automation (SPEC-011).
- Ritual casting or wild magic mechanics.

---

## 2. Background & Context

Spell data comes from the 5e-database SRD **2014 edition**, located at:

```
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Spells.json
```

Each spell in the SRD has an `index` (e.g. `"fireball"`), `name`, `level` (0–9), `school`, `components`, `casting_time`, `range`, `duration`, `concentration` (boolean), `desc`, `higher_level`, `classes`, and optional `damage`/`heal_at_slot_level` fields.

Spell slots per class and level are defined in the SRD class tables. For this spec, slots are managed manually per character rather than derived automatically from class/level — automatic derivation is deferred to SPEC-003 once character levels are fully modelled.

**Related Specs:**
- SPEC-001 — auth and campaign (required, done).
- SPEC-002 — SRD seeding; spell data must be seeded before this feature works.
- SPEC-003 — character sheet; `character_id` FK used throughout.
- SPEC-011 — short/long rest recovery.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | A player MUST be able to add a spell to their character from the 2014 SRD spell list. |
| FR-002 | MUST     | A player MUST be able to remove a spell from their character. |
| FR-003 | MUST     | The system MUST track whether each spell is **known** or **prepared** (class-dependent distinction is presentational only). |
| FR-004 | MUST     | The system MUST track spell slots for levels 1–9: total slots and slots used. |
| FR-005 | MUST     | A player MUST be able to expend a spell slot of any level. |
| FR-006 | MUST     | A player MUST be able to recover all spell slots (long rest — SPEC-011 triggers this). |
| FR-007 | MUST     | The system MUST enforce that only one concentration spell is active at a time; starting a new concentration spell ends the previous one. |
| FR-008 | MUST     | A player MUST be able to manually end concentration. |
| FR-009 | SHOULD   | The system SHOULD display the spell's full details (from SRD) inline when viewing the character's spell list. |
| FR-010 | SHOULD   | The system SHOULD warn the player when they attempt to cast a spell that requires concentration while already concentrating. |
| FR-011 | MAY      | The system MAY track cantrips (level 0 spells) as always-available (no slots needed). |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Data        | Spell data MUST come from the 5e-database **2014 edition** (`/src/2014/5e-SRD-Spells.json`). |
| NFR-002 | Performance | Spell list endpoints MUST respond in under 300ms. |
| NFR-003 | Correctness | Spell slots used MUST never exceed total slots for that level. |

### 3.3 Constraints

- Only the character's owner (and the DM in read mode) may modify spell state.
- Slot totals are set manually by the player; automatic derivation from class tables is out of scope.

---

## 4. User Stories

### US-001: Add a Spell

**As a** player,
**I want to** add a spell from the SRD to my character's spell list,
**so that** I can track which spells I have access to.

**Acceptance Criteria:**
- [ ] AC-001: Given I search by name or school, when I select a spell, then it is added to my character's spell list.
- [ ] AC-002: Given I add a spell already on my list, then I receive a 409 error.
- [ ] AC-003: Given the spell has level 0, then it is added as a cantrip with no slot requirements.

---

### US-002: Manage Spell Slots

**As a** player,
**I want to** track how many spell slots I have and have used per level,
**so that** I know what I can cast during a session.

**Acceptance Criteria:**
- [ ] AC-001: Given I set total slots for level 3 to 4, when I view my sheet, then I see "4 / 4 slots" for level 3.
- [ ] AC-002: Given I have 2 level-3 slots remaining, when I expend one, then I have 1 remaining.
- [ ] AC-003: Given I have 0 level-3 slots remaining, when I try to expend one, then I receive an error.

---

### US-003: Concentration Tracker

**As a** player,
**I want to** mark a spell as my active concentration spell,
**so that** I and the DM can see at a glance what I am concentrating on.

**Acceptance Criteria:**
- [ ] AC-001: Given I start concentrating on `hold-person`, when I view my sheet, then I see "Concentrating: Hold Person".
- [ ] AC-002: Given I am already concentrating, when I start concentrating on a new spell, then the previous spell's concentration is automatically dropped.
- [ ] AC-003: Given I manually end concentration, then my sheet shows no active concentration spell.

---

## 5. Design

### 5.1 Data Model

```typescript
interface CharacterSpell {
  id: string;             // UUID
  characterId: string;    // FK → characters.id
  spellIndex: string;     // SRD index, e.g. "fireball"
  status: 'known' | 'prepared';
  addedAt: Date;
  // UNIQUE (character_id, spell_index)
}

interface SpellSlots {
  id: string;
  characterId: string;    // FK → characters.id (UNIQUE per character)
  // level 1–9 total and used
  l1Total: number; l1Used: number;
  l2Total: number; l2Used: number;
  l3Total: number; l3Used: number;
  l4Total: number; l4Used: number;
  l5Total: number; l5Used: number;
  l6Total: number; l6Used: number;
  l7Total: number; l7Used: number;
  l8Total: number; l8Used: number;
  l9Total: number; l9Used: number;
  updatedAt: Date;
}

interface ConcentrationTracker {
  id: string;
  characterId: string;    // FK → characters.id (UNIQUE per character)
  spellIndex: string | null;   // null = not concentrating
  startedAt: Date | null;
  updatedAt: Date;
}
```

### 5.2 API Design

**`GET /api/v1/characters/:id/spells`** _(auth, campaign member)_
```json
// Response 200
{
  "slots": { "l1": { "total": 4, "used": 1 }, "l2": { "total": 3, "used": 0 }, ... },
  "concentration": { "spellIndex": "hold-person", "name": "Hold Person", "startedAt": "..." },
  "spells": [
    { "spellIndex": "fireball", "name": "Fireball", "level": 3, "school": "Evocation", "status": "known", "concentration": false },
    { "spellIndex": "hold-person", "name": "Hold Person", "level": 2, "school": "Enchantment", "status": "prepared", "concentration": true }
  ]
}
```

**`POST /api/v1/characters/:id/spells`** _(auth, character owner)_
```json
// Request
{ "spellIndex": "fireball", "status": "known" }
// Response 201
{ "spellIndex": "fireball", "name": "Fireball", "level": 3, "status": "known" }
```

**`DELETE /api/v1/characters/:id/spells/:spellIndex`** _(auth, character owner)_
```json
// Response 204 No Content
```

**`PUT /api/v1/characters/:id/spell-slots`** _(auth, character owner)_
```json
// Request — set totals
{ "l1Total": 4, "l2Total": 3, "l3Total": 3, "l4Total": 1 }
// Response 200
{ "l1": { "total": 4, "used": 0 }, ... }
```

**`POST /api/v1/characters/:id/spell-slots/expend`** _(auth, character owner)_
```json
// Request
{ "level": 3 }
// Response 200
{ "l3": { "total": 3, "used": 1 } }
```

**`POST /api/v1/characters/:id/spell-slots/recover`** _(auth, character owner)_
```json
// Request
{ "type": "long" }
// Response 200 — all used reset to 0
```

**`PUT /api/v1/characters/:id/concentration`** _(auth, character owner)_
```json
// Request
{ "spellIndex": "hold-person" }   // or null to end concentration
// Response 200
{ "spellIndex": "hold-person", "name": "Hold Person", "startedAt": "..." }
```

### 5.3 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Spell index not found in SRD | `SPELL_NOT_FOUND` | 404 |
| Spell already on character | `ALREADY_KNOWN` | 409 |
| Slot level out of range (not 1–9) | `VALIDATION_ERROR` | 400 |
| Not enough slots remaining | `INSUFFICIENT_SLOTS` | 400 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Expend slot — used count increments, cannot exceed total.
- [ ] Recover long rest — all used reset to 0.
- [ ] Set concentration — previous concentration cleared automatically.

### 6.2 Integration Tests

- [ ] Add spell → appears in GET /spells list.
- [ ] Add duplicate spell → 409.
- [ ] Expend slot → reflected in GET /spells.
- [ ] Expend when 0 remaining → 400.
- [ ] Start concentration → GET shows active concentration.
- [ ] Start second concentration → first is dropped.
- [ ] End concentration manually → GET shows null.

---

## 7. Security Considerations

- [ ] Only the character's owner may modify spells and slots; DM may read.
- [ ] All operations validate campaign membership before acting.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `character_spells`, `spell_slots`, `concentration_tracker` | SPEC-003 T-01 |
| T-02 | Migration | T-01 |
| T-03 | `GET /characters/:id/spells` — joined with SRD spell data | SPEC-002, T-02 |
| T-04 | `POST /characters/:id/spells` + `DELETE` | T-03 |
| T-05 | `PUT /characters/:id/spell-slots` + `POST expend` + `POST recover` | T-02 |
| T-06 | `PUT /characters/:id/concentration` | T-02 |
| T-07 | Frontend: Spells tab on character sheet (list + add modal) | T-04 |
| T-08 | Frontend: Spell slot tracker UI (grid of pips per level) | T-05 |
| T-09 | Frontend: Concentration badge + clear button | T-06 |
| T-10 | Unit + integration tests | T-03–T-06 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should `status` (known vs prepared) affect any gameplay logic, or is it purely a label? | Team | Open | — |
| 2 | Should Pact Magic slots (Warlock) be tracked separately from standard slots? | Team | Open | — |
| 3 | Should short rest slot recovery be a fixed amount or input by the player? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Use 5e-database **2014 edition** (`/src/2014/`) for all spell data | Matches the players' ruleset; 2024 edition data is not yet in the repo | 2024 edition |
| 2026-03-09 | Store slots as flat columns (l1Total…l9Used) rather than a JSONB array | Simple queries, easy validation per level | JSONB `{ "1": { total, used }, ... }` |
| 2026-03-09 | Manual slot totals (not auto-derived from class/level) | Avoids dependency on full class table modelling (SPEC-003) | Auto-derive from class_id + level |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
