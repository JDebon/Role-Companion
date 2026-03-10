# Spec: SRD Data Seeding + Compendium Search

**Spec ID:** SPEC-002
**Status:** Implemented
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers importing the D&D 5e 2014 System Reference Document (SRD) data from the `5e-bits/5e-database` repository into the local PostgreSQL database, and exposing compendium search endpoints so the rest of the app can look up spells, monsters, equipment, and other game entities without calling an external API.

### 1.2 Problem Statement

SPEC-005 (Spell Management), SPEC-006 (Custom Content), and SPEC-007 (DM Tools) all need to reference canonical 5e game data — spell names, monster stat blocks, equipment entries. Without a local seed, those features would either depend on runtime calls to an external API (fragile, rate-limited) or duplicate data inline. A one-time seed gives the whole app a stable, queryable reference layer.

### 1.3 Goals

- [ ] Write a seed script that downloads the 2014 SRD JSON files from `5e-bits/5e-database` and imports them into local DB tables.
- [ ] Seed the following collections: Spells, Monsters, Equipment, Magic Items, Classes, Races, Backgrounds, Conditions, Damage Types, Skills, Magic Schools, Weapon Properties.
- [ ] Expose compendium search endpoints for Spells, Monsters, and Equipment (the three most used by other specs).
- [ ] Ensure the seed script is idempotent (safe to run multiple times).

### 1.4 Non-Goals

- Seeding every available 2014 SRD collection (Features, Subclasses, Traits, etc.) — these can be added later on demand.
- Third-party content (Open5e, Kobold Press) — out of scope for this spec.
- Full-text search with ranking (plain `ILIKE` is sufficient for now).
- A user-facing compendium browser UI (only API endpoints are in scope here).

---

## 2. Background & Context

The data source is the **5e-bits/5e-database** GitHub repository, **2014 edition directory**:

```
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-{Collection}.json
```

Each JSON file is an array of objects. Every object has an `index` (kebab-case unique key, e.g. `"fireball"`) and a `name` (display name, e.g. `"Fireball"`). Most other fields are collection-specific.

Because the data is read-only reference material (never edited by users), it is stored in dedicated `srd_*` tables rather than mixed with user data. The full JSON of each entity is stored in a JSONB `data` column alongside a small set of denormalized columns used for filtering and sorting.

**Collections and target tables:**

| JSON file | Table | Key filter columns |
|-----------|-------|--------------------|
| `5e-SRD-Spells.json` | `srd_spells` | level, school, classes |
| `5e-SRD-Monsters.json` | `srd_monsters` | challenge_rating, type, size |
| `5e-SRD-Equipment.json` | `srd_equipment` | equipment_category, weapon_category |
| `5e-SRD-Magic-Items.json` | `srd_magic_items` | rarity |
| `5e-SRD-Classes.json` | `srd_classes` | — |
| `5e-SRD-Races.json` | `srd_races` | — |
| `5e-SRD-Backgrounds.json` | `srd_backgrounds` | — |
| `5e-SRD-Conditions.json` | `srd_conditions` | — |
| `5e-SRD-Damage-Types.json` | `srd_damage_types` | — |
| `5e-SRD-Skills.json` | `srd_skills` | — |
| `5e-SRD-Magic-Schools.json` | `srd_magic_schools` | — |
| `5e-SRD-Weapon-Properties.json` | `srd_weapon_properties` | — |

**Related Specs:**
- All other specs depend on this one for reference data.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | The seed script MUST fetch data from `5e-bits/5e-database` **2014 edition** (`/src/2014/`) and insert it into the local DB. |
| FR-002 | MUST     | The seed script MUST be idempotent: running it twice MUST NOT create duplicate rows (use upsert on `index`). |
| FR-003 | MUST     | The system MUST expose `GET /api/v1/compendium/spells` with `?q=`, `?level=`, `?school=`, `?class=` filters. |
| FR-004 | MUST     | The system MUST expose `GET /api/v1/compendium/spells/:index` returning the full spell data. |
| FR-005 | MUST     | The system MUST expose `GET /api/v1/compendium/monsters` with `?q=`, `?cr=`, `?type=` filters. |
| FR-006 | MUST     | The system MUST expose `GET /api/v1/compendium/monsters/:index` returning the full monster stat block. |
| FR-007 | MUST     | The system MUST expose `GET /api/v1/compendium/equipment` with `?q=`, `?category=` filters. |
| FR-008 | MUST     | The system MUST expose `GET /api/v1/compendium/equipment/:index` returning full item data. |
| FR-009 | SHOULD   | The system SHOULD expose list endpoints for the remaining seeded collections (classes, races, backgrounds, conditions, skills) with `?q=` search. |
| FR-010 | SHOULD   | Compendium endpoints SHOULD support pagination (`?page=`, `?limit=` defaulting to 20). |
| FR-011 | MAY      | The seed script MAY be triggered automatically on first deploy (e.g., `docker compose` `command` or startup check). |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Data        | All seeded data MUST originate from `/src/2014/` in the `5e-bits/5e-database` repo, ensuring 2014 edition rules only. |
| NFR-002 | Performance | Compendium list endpoints MUST respond in under 200ms for up to 50 results. |
| NFR-003 | Idempotence | The seed script MUST use `INSERT … ON CONFLICT (index) DO UPDATE` for all tables. |
| NFR-004 | Auth        | Compendium endpoints are **auth-required** (valid JWT) but not campaign-scoped. |

### 3.3 Constraints

- SRD data is read-only; no endpoint modifies `srd_*` tables.
- The seed script runs as a one-off Node.js script inside the `packages/db` package.
- Data fetched at seed time is pinned to the state of the `main` branch of `5e-bits/5e-database`.

---

## 4. User Stories

### US-001: Seed SRD Data on First Setup

**As a** developer setting up RoleCompanion,
**I want to** run a single command that imports all 2014 SRD data,
**so that** spells, monsters, and items are available without any manual data entry.

**Acceptance Criteria:**
- [ ] AC-001: Given the DB is empty, when I run `pnpm --filter @rolecompanion/db seed`, then all seeded tables are populated with 2014 SRD data.
- [ ] AC-002: Given the seed has already run, when I run it again, then no duplicate rows are created and the command exits successfully.
- [ ] AC-003: Given the seed is complete, then `srd_spells` contains 319 spells, `srd_monsters` contains 334 monsters (counts per the 2014 SRD).

---

### US-002: Search Spells

**As a** logged-in user,
**I want to** search for spells by name, level, or school,
**so that** I can find a spell to add to my character or reference during play.

**Acceptance Criteria:**
- [ ] AC-001: Given `?q=fire`, when I call `GET /compendium/spells`, then results include "Fireball", "Fire Bolt", "Fire Storm".
- [ ] AC-002: Given `?level=3&school=evocation`, then only level-3 Evocation spells are returned.
- [ ] AC-003: Given `GET /compendium/spells/fireball`, then the full spell data including description, components, and damage is returned.

---

### US-003: Look Up a Monster

**As a** Dungeon Master,
**I want to** search for a monster by name or challenge rating,
**so that** I can add it to an encounter quickly.

**Acceptance Criteria:**
- [ ] AC-001: Given `?q=goblin`, when I call `GET /compendium/monsters`, then "Goblin", "Goblin Boss", etc. are returned.
- [ ] AC-002: Given `?cr=5`, then only CR 5 monsters are returned.
- [ ] AC-003: Given `GET /compendium/monsters/goblin`, then the full stat block (HP, AC, actions, abilities) is returned.

---

## 5. Design

### 5.1 Data Model

All `srd_*` tables follow the same pattern:

```typescript
interface SrdEntry {
  index: string;          // PRIMARY KEY — kebab-case, e.g. "fireball"
  name: string;           // Display name, e.g. "Fireball"
  data: Record<string, unknown>; // Full JSON from 5e-database
  // Denormalized filter columns (vary per table):
}

// srd_spells extras:
interface SrdSpell extends SrdEntry {
  level: number;          // 0–9
  school: string;         // e.g. "Evocation"
  concentration: boolean;
  ritual: boolean;
  classes: string[];      // array of class names
}

// srd_monsters extras:
interface SrdMonster extends SrdEntry {
  challengeRating: number;
  monsterType: string;    // e.g. "humanoid"
  size: string;           // e.g. "Small"
}

// srd_equipment extras:
interface SrdEquipment extends SrdEntry {
  equipmentCategory: string; // e.g. "Weapon", "Armor"
  weaponCategory: string | null;
}

// srd_magic_items extras:
interface SrdMagicItem extends SrdEntry {
  rarity: string;         // e.g. "rare", "very rare"
}

// All other collections: just index, name, data
```

### 5.2 Seed Script

Location: `packages/db/src/seed.ts`

```typescript
// Pseudocode
const BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014'

const collections = [
  { file: '5e-SRD-Spells', table: 'srd_spells', transform: transformSpell },
  { file: '5e-SRD-Monsters', table: 'srd_monsters', transform: transformMonster },
  { file: '5e-SRD-Equipment', table: 'srd_equipment', transform: transformEquipment },
  { file: '5e-SRD-Magic-Items', table: 'srd_magic_items', transform: transformMagicItem },
  { file: '5e-SRD-Classes', table: 'srd_classes', transform: base },
  { file: '5e-SRD-Races', table: 'srd_races', transform: base },
  { file: '5e-SRD-Backgrounds', table: 'srd_backgrounds', transform: base },
  { file: '5e-SRD-Conditions', table: 'srd_conditions', transform: base },
  { file: '5e-SRD-Skills', table: 'srd_skills', transform: base },
  { file: '5e-SRD-Damage-Types', table: 'srd_damage_types', transform: base },
  { file: '5e-SRD-Magic-Schools', table: 'srd_magic_schools', transform: base },
  { file: '5e-SRD-Weapon-Properties', table: 'srd_weapon_properties', transform: base },
]

for (const { file, table, transform } of collections) {
  const entries = await fetch(`${BASE}/${file}.json`).then(r => r.json())
  await db.insert(table).values(entries.map(transform))
    .onConflictDoUpdate({ target: [index], set: { name, data, ...denormalized } })
}
```

Add `"seed": "tsx src/seed.ts"` to `packages/db/package.json`.

### 5.3 API Design

All endpoints require `Authorization: Bearer <JWT>`. No campaign scope.

**`GET /api/v1/compendium/spells`**
```
Query: ?q=fire&level=3&school=evocation&class=wizard&page=1&limit=20
Response 200: { data: [...spells], total: 12, page: 1, limit: 20 }
Each item: { index, name, level, school, concentration, ritual, classes }
```

**`GET /api/v1/compendium/spells/:index`**
```
Response 200: full spell data object from srd_spells.data
Response 404: { error: "NOT_FOUND" }
```

**`GET /api/v1/compendium/monsters`**
```
Query: ?q=goblin&cr=1&type=humanoid&page=1&limit=20
Response 200: { data: [...monsters], total: 8, page: 1, limit: 20 }
Each item: { index, name, challengeRating, monsterType, size, hitPoints, armorClass }
```

**`GET /api/v1/compendium/monsters/:index`**
```
Response 200: full stat block from srd_monsters.data
```

**`GET /api/v1/compendium/equipment`**
```
Query: ?q=sword&category=Weapon&page=1&limit=20
Response 200: { data: [...items], total: 5, page: 1, limit: 20 }
```

**`GET /api/v1/compendium/equipment/:index`**
```
Response 200: full item data
```

**`GET /api/v1/compendium/:collection`** _(for classes, races, backgrounds, conditions, skills)_
```
Query: ?q=
Response 200: { data: [{ index, name }], total, page, limit }
```

### 5.4 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Index not found | `NOT_FOUND` | 404 |
| Unauthenticated request | `UNAUTHORIZED` | 401 |
| Unknown collection name | `NOT_FOUND` | 404 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] `transformSpell` — correctly extracts level, school, concentration, classes from raw JSON.
- [ ] `transformMonster` — correctly extracts challenge_rating, type, size.

### 6.2 Integration Tests (test DB with seeded data)

- [ ] `GET /compendium/spells?q=fire` returns results including "Fireball".
- [ ] `GET /compendium/spells?level=1&school=Evocation` returns only level-1 evocation spells.
- [ ] `GET /compendium/spells/fireball` returns full spell data with `level: 3`.
- [ ] `GET /compendium/monsters?cr=1/4` returns goblins and similar CR 1/4 creatures.
- [ ] `GET /compendium/monsters/goblin` returns stat block with HP 7 and AC 15.
- [ ] Unknown index `GET /compendium/spells/does-not-exist` → 404.
- [ ] Unauthenticated request → 401.
- [ ] Seed idempotence — run seed twice, no duplicates.

---

## 7. Security Considerations

- [ ] Compendium endpoints require a valid JWT to prevent unauthenticated scraping.
- [ ] All data is read-only; no write endpoints exist for `srd_*` tables.
- [ ] The seed script runs in a privileged context (direct DB access) and is not exposed via HTTP.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: all `srd_*` tables | SPEC-001 T-01 |
| T-02 | Migration | T-01 |
| T-03 | Seed script (`packages/db/src/seed.ts`) with transform functions | T-02 |
| T-04 | Add `"seed"` script to `packages/db/package.json` | T-03 |
| T-05 | Run seed against dev DB; verify row counts | T-04 |
| T-06 | Add seed step to `docker-compose.test.yml` entrypoint | T-04 |
| T-07 | `GET /compendium/spells` list + detail endpoints | T-02 |
| T-08 | `GET /compendium/monsters` list + detail endpoints | T-02 |
| T-09 | `GET /compendium/equipment` list + detail endpoints | T-02 |
| T-10 | Generic `GET /compendium/:collection` for remaining tables | T-02 |
| T-11 | Mount compendium router in `apps/api/src/app.ts` | T-07–T-10 |
| T-12 | Unit + integration tests | T-03–T-10 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should the seed run automatically on `docker compose up` (entrypoint), or remain a manual step? | Team | Open | — |
| 2 | Should CR be stored as a float (0.125, 0.25, 0.5, 1–30) or as a string ("1/8", "1/4")? | Team | Open | — |
| 3 | Should compendium endpoints be open (no JWT) for convenience during development? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Fetch from `5e-bits/5e-database` **`/src/2014/`** at seed time | Pinned to 2014 edition; no runtime external dependency | Runtime API calls to dnd5eapi.co |
| 2026-03-09 | Store full JSON in `data` JSONB + denormalized filter columns | Flexible querying without parsing JSON in SQL; fast filters | Fully normalized tables per collection |
| 2026-03-09 | Seed lives in `packages/db` | Co-located with schema and migrations | Separate seed package |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
