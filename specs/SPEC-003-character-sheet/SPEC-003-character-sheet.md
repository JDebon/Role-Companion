# Spec: Character Sheet

**Spec ID:** SPEC-003
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers the player character record: ability scores, HP, AC, level, proficiency bonus, skills, saving throws, class/race/background, and class features. Each character belongs to a single campaign and is owned by a single player.

### 1.2 Problem Statement

Every other gameplay spec (spells, inventory, encounters, notes) hangs off a `character_id`. Without a character sheet model, those features have no anchor. This spec establishes the canonical character record and the API to create, read, and update it.

### 1.3 Goals

- [ ] Allow a player to create one or more characters within a campaign.
- [ ] Store and update all core 5e 2014 character attributes: ability scores, HP, AC, level, skills, saving throws.
- [ ] Allow the DM (read-only) and the character owner (read-write) to access the sheet.
- [ ] Derive secondary statistics (ability modifiers, skill bonuses, saving throw bonuses) server-side so the client never has to compute them.

### 1.4 Non-Goals

- Spell management (SPEC-005).
- Inventory (SPEC-004).
- Multiclassing (deferred).
- Automatic feature/proficiency population from SRD class tables (SPEC-002 is a prerequisite; auto-fill is a stretch goal).
- Character creation wizard (manual entry in this spec).

---

## 2. Background & Context

The 5e 2014 ability score modifier formula: `floor((score - 10) / 2)`.
Proficiency bonus by level: levels 1–4 = +2, 5–8 = +3, 9–12 = +4, 13–16 = +5, 17–20 = +6.
Skill bonuses = ability modifier + (proficiency bonus if proficient) + (proficiency bonus again if expertise).
Saving throw bonuses = ability modifier + (proficiency bonus if proficient).

Class and race names are stored as free text strings in this spec. Future specs may link them to `srd_classes` / `srd_races` (SPEC-002).

**Related Specs:**
- SPEC-001 — auth and campaigns (required, done).
- SPEC-002 — SRD data (optional for free-text class/race fields; required for auto-fill stretch goal).
- SPEC-004 — Inventory hangs off `character_id`.
- SPEC-005 — Spell management hangs off `character_id`.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | A player MUST be able to create a character with a name within a campaign. |
| FR-002 | MUST     | The system MUST store the six ability scores (STR, DEX, CON, INT, WIS, CHA). |
| FR-003 | MUST     | The system MUST store and allow updating current HP, max HP, and temporary HP. |
| FR-004 | MUST     | The system MUST store AC, speed, level, class name, race name, and background name. |
| FR-005 | MUST     | The system MUST derive and return ability modifiers for all six scores. |
| FR-006 | MUST     | The system MUST store skill proficiencies and expertise flags, and return the full skill bonus for each of the 18 skills. |
| FR-007 | MUST     | The system MUST store saving throw proficiencies and return the full saving throw bonus per ability. |
| FR-008 | MUST     | The system MUST return the proficiency bonus derived from character level. |
| FR-009 | MUST     | Only the character's owner MUST be able to modify the character. |
| FR-010 | MUST     | The campaign DM MUST be able to read any character sheet in the campaign. |
| FR-011 | MUST     | All other campaign members (players) MUST be able to read each other's character sheets. |
| FR-012 | SHOULD   | The system SHOULD store class features and traits as a free-text list. |
| FR-013 | SHOULD   | The system SHOULD store a character portrait URL and backstory text. |
| FR-014 | MAY      | The system MAY allow a player to have multiple characters in the same campaign. |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Correctness | Ability modifiers and derived bonuses MUST use the 2014 SRD formulas. |
| NFR-002 | Performance | Character sheet GET MUST respond in under 200ms. |
| NFR-003 | Validation  | Ability scores MUST be between 1 and 30. HP values MUST be non-negative. Level MUST be between 1 and 20. |

### 3.3 Constraints

- A character belongs to exactly one campaign and one player; it cannot be transferred.
- Character data is campaign-scoped: all members of the campaign can read it.

---

## 4. User Stories

### US-001: Create a Character

**As a** Player,
**I want to** create a character in my campaign,
**so that** I have a sheet to track my stats during play.

**Acceptance Criteria:**
- [ ] AC-001: Given I am a campaign member, when I POST a character with a name, class, race, and level, then the character is created and its `id` is returned.
- [ ] AC-002: Given I create a character with STR 16, then the returned modifier is +3.
- [ ] AC-003: Given I am not a member of the campaign, when I try to create a character, then I receive HTTP 404.

---

### US-002: View a Character Sheet

**As a** Player or DM,
**I want to** view a character's full sheet,
**so that** I can reference stats during the session.

**Acceptance Criteria:**
- [ ] AC-001: Given any campaign member calls `GET /characters/:id`, then they receive the full sheet including ability scores, modifiers, HP, AC, skill bonuses, and saving throw bonuses.
- [ ] AC-002: Given a character with level 5 and DEX 14 with Acrobatics proficiency, then Acrobatics bonus = +5 (mod +2, proficiency +3).

---

### US-003: Update HP

**As a** Player,
**I want to** update my current HP after taking damage or receiving healing,
**so that** my sheet reflects my actual health state.

**Acceptance Criteria:**
- [ ] AC-001: Given my max HP is 28 and current HP is 15, when I PATCH `currentHp` to 22, then the sheet shows 22/28.
- [ ] AC-002: Given I try to set `currentHp` above `maxHp`, then I receive a validation error.
- [ ] AC-003: Given another player tries to PATCH my character, then they receive HTTP 403.

---

## 5. Design

### 5.1 Data Model

```typescript
type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
type ProficiencyLevel = 'none' | 'proficient' | 'expertise';

// 18 skills mapped to their governing ability (2014 SRD)
const SKILL_ABILITY: Record<string, Ability> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int',
  athletics: 'str', deception: 'cha', history: 'int',
  insight: 'wis', intimidation: 'cha', investigation: 'int',
  medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int',
  sleight_of_hand: 'dex', stealth: 'dex', survival: 'wis',
}

interface Character {
  id: string;               // UUID
  campaignId: string;       // FK → campaigns.id
  userId: string;           // FK → users.id (owner)
  name: string;             // max 100 chars
  className: string;        // free text, e.g. "Fighter"
  subclassName: string | null;
  raceName: string;         // free text, e.g. "Half-Elf"
  backgroundName: string;   // free text, e.g. "Soldier"
  level: number;            // 1–20
  experiencePoints: number;
  // Ability scores
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
  // HP
  maxHp: number;
  currentHp: number;
  temporaryHp: number;
  // Combat
  armorClass: number;
  initiative: number | null;  // override; null = use DEX mod
  speed: number;              // feet
  // Proficiencies (18 skills + 6 saving throws)
  skillProficiencies: Record<string, ProficiencyLevel>; // JSONB
  savingThrowProficiencies: Record<Ability, boolean>;   // JSONB
  // Narrative
  backstory: string | null;
  portraitUrl: string | null;
  traits: string[];    // JSONB array — features, racial traits, etc.
  // Meta
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Derived Values (computed server-side)

```typescript
function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1  // 2 at 1, 3 at 5, 4 at 9, 5 at 13, 6 at 17
}

function skillBonus(skill: string, char: Character): number {
  const mod = abilityMod(char[SKILL_ABILITY[skill]])
  const prof = char.skillProficiencies[skill]
  const pb = proficiencyBonus(char.level)
  if (prof === 'expertise') return mod + pb * 2
  if (prof === 'proficient') return mod + pb
  return mod
}

function savingThrowBonus(ability: Ability, char: Character): number {
  const mod = abilityMod(char[ability])
  return char.savingThrowProficiencies[ability] ? mod + proficiencyBonus(char.level) : mod
}
```

### 5.3 API Design

**`GET /api/v1/campaigns/:id/characters`** _(auth, campaign member)_
```json
[{ "id": "...", "name": "Thorin", "className": "Fighter", "raceName": "Dwarf", "level": 5, "currentHp": 44, "maxHp": 52 }]
```

**`POST /api/v1/campaigns/:id/characters`** _(auth, campaign member)_
```json
// Request
{
  "name": "Thorin Ironbeard",
  "className": "Fighter", "raceName": "Dwarf", "backgroundName": "Soldier",
  "level": 1,
  "str": 17, "dex": 12, "con": 16, "int": 10, "wis": 13, "cha": 8,
  "maxHp": 13, "currentHp": 13, "temporaryHp": 0,
  "armorClass": 18, "speed": 25
}
// Response 201 — full sheet with derived values
```

**`GET /api/v1/characters/:id`** _(auth, campaign member)_
```json
{
  "id": "...", "name": "Thorin Ironbeard",
  "className": "Fighter", "raceName": "Dwarf", "backgroundName": "Soldier",
  "level": 1, "proficiencyBonus": 2,
  "abilityScores": {
    "str": { "score": 17, "modifier": 3 },
    "dex": { "score": 12, "modifier": 1 },
    "con": { "score": 16, "modifier": 3 },
    "int": { "score": 10, "modifier": 0 },
    "wis": { "score": 13, "modifier": 1 },
    "cha": { "score": 8, "modifier": -1 }
  },
  "hp": { "current": 13, "max": 13, "temporary": 0 },
  "armorClass": 18, "speed": 25,
  "skills": {
    "athletics": { "proficiency": "proficient", "bonus": 5 },
    "acrobatics": { "proficiency": "none", "bonus": 1 },
    ...
  },
  "savingThrows": {
    "str": { "proficient": true, "bonus": 5 },
    "con": { "proficient": true, "bonus": 5 },
    ...
  },
  "traits": ["Second Wind", "Action Surge"],
  "backstory": null, "portraitUrl": null
}
```

**`PATCH /api/v1/characters/:id`** _(auth, character owner only)_
```json
// Request — any subset of mutable fields
{ "currentHp": 8, "temporaryHp": 5 }
// Response 200 — full updated sheet
```

**`DELETE /api/v1/characters/:id`** _(auth, character owner or DM)_
```json
// Response 204 No Content
```

### 5.4 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Ability score out of range (1–30) | `VALIDATION_ERROR` | 400 |
| Level out of range (1–20) | `VALIDATION_ERROR` | 400 |
| `currentHp` > `maxHp` | `VALIDATION_ERROR` | 400 |
| Non-owner tries to PATCH | `FORBIDDEN` | 403 |
| Character not in requester's campaign | `NOT_FOUND` | 404 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] `abilityMod(10)` = 0, `abilityMod(16)` = 3, `abilityMod(8)` = -1.
- [ ] `proficiencyBonus(1)` = 2, `proficiencyBonus(5)` = 3, `proficiencyBonus(20)` = 6.
- [ ] `skillBonus` with proficiency and expertise.
- [ ] HP validation — currentHp cannot exceed maxHp.

### 6.2 Integration Tests

- [ ] Create character → GET returns full sheet with correct derived values.
- [ ] PATCH currentHp → updated immediately.
- [ ] PATCH currentHp > maxHp → 400.
- [ ] Non-owner PATCH → 403.
- [ ] DM reads character → 200.
- [ ] Non-member reads character → 404.
- [ ] Level 5 character with DEX 14, Acrobatics proficient → Acrobatics bonus = +5.

---

## 7. Security Considerations

- [ ] Character data is campaign-scoped: the `campaignId` is always verified against the requester's membership.
- [ ] Only the owning player may modify a character; the DM may only read (and delete).
- [ ] `portraitUrl`, if provided, is validated as a valid HTTPS URL to prevent XSS or SSRF vectors.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `characters` table | SPEC-001 T-01 |
| T-02 | Migration | T-01 |
| T-03 | Utility functions: `abilityMod`, `proficiencyBonus`, `skillBonus`, `savingThrowBonus` | — |
| T-04 | `POST /campaigns/:id/characters` | T-02, T-03 |
| T-05 | `GET /campaigns/:id/characters` (list) | T-02 |
| T-06 | `GET /characters/:id` (full sheet with derived values) | T-03, T-05 |
| T-07 | `PATCH /characters/:id` (owner only, validated) | T-06 |
| T-08 | `DELETE /characters/:id` | T-06 |
| T-09 | Mount characters router in `apps/api/src/app.ts` | T-04–T-08 |
| T-10 | Frontend: Character list on campaign dashboard | T-05 |
| T-11 | Frontend: Create character form | T-04 |
| T-12 | Frontend: Character sheet view (stats, skills, saving throws) | T-06 |
| T-13 | Frontend: HP tracker (current / max / temp with +/- controls) | T-07 |
| T-14 | Unit + integration tests | T-03–T-08 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should characters be visible to all campaign members or only the DM and owner? | Team | Open | Current decision: all members can read |
| 2 | Should we cap characters per player per campaign (e.g., 1 active character)? | Team | Open | — |
| 3 | Should experience points auto-level the character? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Derive modifiers and bonuses server-side | Single source of truth; formula defined in spec | Client-side derivation |
| 2026-03-09 | Free-text class/race/background (not FK to SRD tables) | Avoids blocking on SPEC-002; players can homebrew classes | FK to `srd_classes` / `srd_races` |
| 2026-03-09 | JSONB for skill proficiencies and saving throw proficiencies | Avoids 18+ join columns; easy to query per-skill | Separate junction table |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
