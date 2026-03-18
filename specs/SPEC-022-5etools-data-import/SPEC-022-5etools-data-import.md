# Spec: 5etools Extended Data Import

**Spec ID:** SPEC-022
**Status:** Draft
**Created:** 2026-03-17
**Last Updated:** 2026-03-17 (rev 2)
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

Extend the compendium with richer D&D 5e **2014 edition** data from the 5etools-2014-src repository, adding feats, optional class features, full bestiary, expanded spells, vehicles, traps/hazards, loot tables, and languages to the existing SRD seed pipeline.

### 1.2 Problem Statement

The current SRD seed (`5e-bits/5e-database`) covers only the open SRD subset: ~319 spells, ~334 monsters, and limited equipment. It is missing entire categories that are essential for a functional character builder and DM toolkit: feats, subclass features (invocations, maneuvers, metamagic), the full monster catalog, loot tables, and languages. This forces DMs and players to reference external tools for content that should live inside RoleCompanion.

### 1.3 Goals

- [ ] **G-01:** Import feats and expose them via the compendium API.
- [ ] **G-02:** Import optional class features (Eldritch Invocations, Fighting Styles, Metamagic, Battle Maneuvers, etc.) and expose them via the compendium API.
- [ ] **G-03:** Expand the monster/bestiary catalog from ~334 SRD entries using a curated subset of source books: MM, VGM, MPMM, MTF, BGDIA, ToA.
- [ ] **G-04:** Expand the spell list beyond the SRD to include all officially published spells (PHB, XGE, TCE, etc.).
- [ ] **G-05:** Import languages, vehicles, traps/hazards, and loot tables.
- [ ] **G-06:** Keep the seed pipeline fast, offline, and idempotent (fixtures committed to the repo, seeded on every `docker compose up`).
- [ ] **G-07:** Tag every entry with its source book so consumers can filter by source.
- [ ] **G-08:** Extend `srd_races`, `srd_classes`, and `srd_backgrounds` tables with full 5etools 2014 data (all published races/subraces, all subclasses, all backgrounds).

### 1.4 Non-Goals

- Not in scope: Adventure module content (`/data/adventure/`, `/data/book/`).
- Not in scope: Foundry VTT integration files.
- Not in scope: UI changes beyond extending existing compendium search pages.
- Not in scope: Fluff/narrative description files (`fluff-*.json`) — mechanical data only in this spec. Fluff import deferred to a future spec.
- Not in scope: Homebrew or user-generated content tooling.
- Not in scope: Psionics (`psionics.json`) — Mystic class is not in core 5e; defer.
- Not in scope: Deities, cults, boons, decks, or recipes.

---

## 2. Background & Context

The 5etools-2014-src repository (`https://github.com/5etools-mirror-3/5etools-2014-src`) is the source mirror of the `https://2014.5e.tools` fan reference site. It covers exclusively the **2014 edition** D&D 5e ruleset (PHB 2014, MM 2014, DMG 2014, XGE, TCE, VGM, etc.) and does **not** include the 2024 revised edition content. Its `/data` directory contains structured JSON for all officially published 2014-edition content.

**Existing pipeline:**
- `packages/db/src/seed-download.ts` — downloads fixtures from a GitHub raw URL into `fixtures/`
- `packages/db/src/srd-transforms.ts` — pure transform functions per entity type
- `packages/db/src/seed.ts` — loads fixtures, transforms, upserts via Drizzle
- Migrations are hand-authored SQL in `packages/db/migrations/`

**Related Specs:**
- SPEC-002: SRD Seeding — established the compendium pipeline this spec extends.
- SPEC-006: Custom Content — established `entity_type` enum that new types must be registered in.

**References:**
- 5etools 2014 data directory: `https://github.com/5etools-mirror-3/5etools-2014-src/tree/main/data`
- 5etools 2014 site: `https://2014.5e.tools`
- Current SRD source: `https://github.com/5e-bits/5e-database`

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | The system MUST provide a `seed:download-5etools` script that fetches all target data files from 5etools raw GitHub URLs and saves them as committed fixtures in `packages/db/fixtures/5etools/`. |
| FR-002 | MUST     | The seed script MUST be idempotent: re-running it on a populated DB produces no duplicates and updates changed entries. |
| FR-003 | MUST     | Every seeded entity MUST include a `source` field storing the source book abbreviation (e.g., `"PHB"`, `"MM"`, `"XGE"`). |
| FR-004 | MUST     | The following new DB tables MUST be created: `srd_feats`, `srd_optional_features`, `srd_vehicles`, `srd_traps_hazards`, `srd_loot_tables`, `srd_languages`. |
| FR-005 | MUST     | Existing `srd_spells` and `srd_monsters` tables MUST be extended with a `source` column (default `"SRD"`) without breaking existing data. |
| FR-006 | MUST     | The compendium API MUST expose new endpoints for feats and optional features with name search and pagination. |
| FR-007 | MUST     | The compendium API MUST expose new endpoints for languages, vehicles, and traps/hazards. |
| FR-008 | MUST     | Existing `/api/v1/compendium/spells` and `/api/v1/compendium/monsters` endpoints MUST accept an optional `source` query param to filter by source book. |
| FR-009 | SHOULD   | Loot table data SHOULD be importable and accessible via a `/api/v1/compendium/loot-tables` endpoint for DM use. |
| FR-012 | MUST     | The existing `srd_races`, `srd_classes`, and `srd_backgrounds` tables MUST be extended with full 5etools 2014 data, adding a `source` column and upserting all published entries without removing existing SRD rows. |
| FR-010 | SHOULD   | The download script SHOULD report entry counts per file on completion. |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Performance | Seed execution MUST complete in under 60 seconds from local fixture files. |
| NFR-002 | Performance | Compendium API responses MUST remain under 300 ms for paginated queries (limit ≤ 50). |
| NFR-003 | Correctness | All transform functions MUST be pure and covered by unit tests. |
| NFR-004 | Maintainability | Fixtures MUST be committed to the repo so the seed runs fully offline (no network calls at runtime). |
| NFR-FE  | Frontend Errors | Frontend pages MUST display an inline error message when page-load API calls fail. Pages MUST NOT silently redirect away on load errors. Redirect on catch is only permitted for definitive 401/403 responses. |

### 3.3 Constraints

- The 5etools data format differs from 5e-database: entries use a rich `entries[]` text renderer format rather than flat strings. Transforms must handle this without breaking existing consumers.
- Bestiary is split across many source files — the download script fetches only the curated subset (MM, VGM, MPMM, MTF, BGDIA, ToA) and merges them into a single fixture.
- Spells are split across 17 source files — same constraint.
- The existing `entity_type` enum in `packages/db/src/schema.ts` must be extended if new custom content types are needed (follow SPEC-006 pattern).

---

## 4. User Stories

### US-001: Browse feats in the compendium

**As a** player,
**I want to** search and browse all published feats in the compendium,
**so that** I can choose feats for my character without leaving RoleCompanion.

**Acceptance Criteria:**
- [ ] AC-001: Given the compendium API is running, when `GET /api/v1/compendium/feats` is called, then it returns a paginated list of feats with `name`, `source`, and `prerequisite` fields.
- [ ] AC-002: Given a `name` query param, when the endpoint is called, then only feats matching the name (case-insensitive, partial) are returned.
- [ ] AC-003: Given `source=PHB`, when the endpoint is called, then only feats from the Player's Handbook are returned.

### US-002: Browse optional class features

**As a** player,
**I want to** look up Eldritch Invocations, Metamagic options, Fighting Styles, and other optional features by class,
**so that** I can make informed choices when levelling up.

**Acceptance Criteria:**
- [ ] AC-001: Given `GET /api/v1/compendium/optional-features?featureType=EI`, when called, then only Eldritch Invocations are returned.
- [ ] AC-002: Given `featureType=MM`, when called, then only Metamagic options are returned.
- [ ] AC-003: Given `className=Warlock`, when called, then all Warlock optional features are returned.

### US-003: Access the full monster catalog

**As a** DM,
**I want to** search all 3 000+ published monsters instead of just the 334 SRD entries,
**so that** I can build encounters using creatures from any official source book.

**Acceptance Criteria:**
- [ ] AC-001: Given the full bestiary is seeded, when `GET /api/v1/compendium/monsters` is called without filters, then the total count exceeds 1 000.
- [ ] AC-002: Given `source=VGM`, when called, then only monsters from Volo's Guide to Monsters are returned.
- [ ] AC-003: Given existing monster queries without a `source` param, they still return results (backwards compatible).

### US-004: Access the full spell list

**As a** player or DM,
**I want to** search spells from all official source books (XGE, TCE, etc.),
**so that** I can reference or assign non-SRD spells to characters.

**Acceptance Criteria:**
- [ ] AC-001: Given the full spell list is seeded, when `GET /api/v1/compendium/spells` is called, then the total count exceeds 500.
- [ ] AC-002: Given `source=TCE`, when called, then only spells from Tasha's Cauldron are returned.

### US-005: Look up languages, vehicles, and traps

**As a** DM or player,
**I want to** look up languages, vehicle stat blocks, and trap/hazard mechanics in RoleCompanion,
**so that** I don't need an external reference during play.

**Acceptance Criteria:**
- [ ] AC-001: Given `GET /api/v1/compendium/languages`, then a list of D&D languages is returned with `name` and `type` (Standard/Exotic).
- [ ] AC-002: Given `GET /api/v1/compendium/vehicles`, then a list of vehicles/mounts is returned.
- [ ] AC-003: Given `GET /api/v1/compendium/traps-hazards`, then a list of traps and hazards is returned with `name` and `type`.

---

## 5. Design

### 5.1 High-Level Design

```
seed:download-5etools
  └─ fetch raw JSON from 5etools GitHub
  └─ merge multi-file categories (bestiary-*.json → one fixture, spells-*.json → one fixture)
  └─ write to packages/db/fixtures/5etools/

docker compose up
  └─ entrypoint runs: migrate → seed (SRD) → seed-5etools
  └─ all seeds are idempotent (onConflictDoUpdate)

GET /api/v1/compendium/feats?name=...&source=...&limit=...&offset=...
GET /api/v1/compendium/optional-features?featureType=...&className=...
GET /api/v1/compendium/spells?source=...   (extended existing)
GET /api/v1/compendium/monsters?source=... (extended existing)
GET /api/v1/compendium/languages
GET /api/v1/compendium/vehicles
GET /api/v1/compendium/traps-hazards
GET /api/v1/compendium/loot-tables
```

### 5.2 Data Model

#### New tables

```sql
-- srd_feats
CREATE TABLE srd_feats (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'PHB',
  prerequisite TEXT,
  data         JSONB NOT NULL
);

-- srd_optional_features
CREATE TABLE srd_optional_features (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  feature_type TEXT NOT NULL,  -- 'EI' | 'MM' | 'FS' | 'MV' | etc.
  class_name   TEXT,           -- nullable; which class this belongs to
  data         JSONB NOT NULL
);

-- srd_languages
CREATE TABLE srd_languages (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'PHB',
  language_type TEXT,          -- 'Standard' | 'Exotic'
  data         JSONB NOT NULL
);

-- srd_vehicles
CREATE TABLE srd_vehicles (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  vehicle_type TEXT,           -- 'SHIP' | 'INFWAR' | 'CREATURE' | etc.
  data         JSONB NOT NULL
);

-- srd_traps_hazards
CREATE TABLE srd_traps_hazards (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL,
  entry_type   TEXT,           -- 'trap' | 'hazard'
  data         JSONB NOT NULL
);

-- srd_loot_tables
CREATE TABLE srd_loot_tables (
  index        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'DMG',
  data         JSONB NOT NULL
);
```

#### Modified tables

```sql
-- Add source column to srd_spells (existing ~319 rows default to 'SRD')
ALTER TABLE srd_spells ADD COLUMN source TEXT NOT NULL DEFAULT 'SRD';

-- Add source column to srd_monsters (existing ~334 rows default to 'SRD')
ALTER TABLE srd_monsters ADD COLUMN source TEXT NOT NULL DEFAULT 'SRD';
```

#### 5etools data shape (key differences from 5e-database)

```typescript
// 5etools feat entry shape
interface FeatRaw {
  name: string
  source: string           // e.g. "PHB", "XGE"
  page: number
  prerequisite?: Array<{ race?: ..., ability?: ..., spellcasting?: boolean }>
  entries: Array<string | object>  // rich text renderer format
  srd?: boolean
  basicRules?: boolean
}

// 5etools optional feature entry shape
interface OptionalFeatureRaw {
  name: string
  source: string
  featureType: string[]   // e.g. ["EI"], ["MM"], ["FS:F"]
  prerequisite?: object[]
  entries: Array<string | object>
  isClassFeatureVariant?: boolean
}

// 5etools monster entry shape
interface MonsterRaw {
  name: string
  source: string           // e.g. "MM", "VGM", "MPMM"
  type: string | { type: string; tags?: string[] }
  cr?: string | { cr: string; lair?: string }
  size: string[]           // e.g. ["M"]
  // ... stat blocks ...
}
```

### 5.3 API / Interface Design

All new endpoints follow the existing compendium pattern: authenticated (JWT), paginated with `limit`/`offset`, returning `{ data: [...], total: number }`.

**GET `/api/v1/compendium/feats`**

Query params: `name` (partial, case-insensitive), `source`, `limit` (default 20, max 100), `offset` (default 0).

Response:
```json
{
  "data": [
    { "index": "actor", "name": "Actor", "source": "PHB", "prerequisite": null, "data": { ... } }
  ],
  "total": 42
}
```

**GET `/api/v1/compendium/optional-features`**

Query params: `name`, `featureType` (e.g. `EI`, `MM`, `FS`), `className`, `source`, `limit`, `offset`.

**GET `/api/v1/compendium/spells`** (extended)

New optional query param: `source` (e.g. `PHB`, `XGE`, `TCE`, `SRD`).

**GET `/api/v1/compendium/monsters`** (extended)

New optional query param: `source` (e.g. `MM`, `VGM`, `MPMM`, `SRD`).

**GET `/api/v1/compendium/languages`**

Query params: `name`, `type` (`Standard` | `Exotic`), `limit`, `offset`.

**GET `/api/v1/compendium/vehicles`**

Query params: `name`, `vehicleType`, `source`, `limit`, `offset`.

**GET `/api/v1/compendium/traps-hazards`**

Query params: `name`, `entryType` (`trap` | `hazard`), `source`, `limit`, `offset`.

**GET `/api/v1/compendium/loot-tables`**

Query params: `name`, `source`, `limit`, `offset`.

### 5.4 Error Handling

| Error Case | Behavior | HTTP Code |
|---|---|---|
| Unknown `source` param | Return empty results (no error) | 200 |
| Unknown `featureType` param | Return empty results (no error) | 200 |
| Download script network failure | Throw with file URL and HTTP status | — (script exit 1) |
| Malformed fixture JSON | Throw with filename and parse error | — (script exit 1) |

**Frontend rule:** Page-load errors MUST render an error message in the page body rather than silently redirecting.

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] `transformFeat()` — maps 5etools feat shape to DB row; handles missing `prerequisite`.
- [ ] `transformOptionalFeature()` — maps feature, extracts `featureType[0]`, extracts class association.
- [ ] `transformMonster5etools()` — handles `type` as string vs. object; handles `cr` as string vs. object.
- [ ] `transformSpell5etools()` — handles `classes.fromClassList` shape; extracts concentration from `duration`.
- [ ] `transformLanguage()` — maps `type` field.
- [ ] `transformVehicle()` — maps `vehicleType`.
- [ ] `transformTrapHazard()` — maps `trapHazType` to `'trap'` | `'hazard'`.

### 6.2 Integration Tests

- [ ] `GET /api/v1/compendium/feats` — returns seeded feats, filters by `name` and `source`.
- [ ] `GET /api/v1/compendium/optional-features` — filters by `featureType=EI` and `featureType=MM`.
- [ ] `GET /api/v1/compendium/spells?source=SRD` — returns only SRD spells (backwards-compatible).
- [ ] `GET /api/v1/compendium/monsters?source=SRD` — returns only SRD monsters (backwards-compatible).
- [ ] `GET /api/v1/compendium/languages` — returns seeded languages.
- [ ] `GET /api/v1/compendium/vehicles` — returns seeded vehicles.
- [ ] `GET /api/v1/compendium/traps-hazards` — returns entries, filters by `entryType`.
- [ ] `GET /api/v1/compendium/loot-tables` — returns seeded loot tables.
- [ ] All endpoints require authentication — unauthenticated requests return 401.

### 6.3 Edge Cases

- [ ] Bestiary entries with `cr` as object (`{ "cr": "1/2", "lair": "2" }`) are handled correctly.
- [ ] Monster `type` as nested object (`{ "type": "humanoid", "tags": ["elf"] }`) is flattened to `"humanoid"`.
- [ ] Spells with concentration embedded in `duration[].concentration` are correctly extracted.
- [ ] Optional features with multiple `featureType` values store the first value.
- [ ] Re-running the seed on existing data produces no duplicate rows.

---

## 7. Security Considerations

- [ ] All new compendium endpoints are authenticated (existing `authMiddleware` applies).
- [ ] All query params are validated via Zod before use in DB queries (prevent injection via ORM).
- [ ] Fixture files are committed and static — no user input reaches the seed pipeline.
- [ ] No sensitive data in compendium entries.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Write `seed-download-5etools.ts`: fetch feats, optional-features, languages, vehicles, trapshazards, loot, races, classes, backgrounds; merge curated bestiary files (MM, VGM, MPMM, MTF, BGDIA, ToA) and all spell files into single fixtures under `fixtures/5etools/` | — |
| T-02 | Write `5etools-transforms.ts`: pure transform functions for all new entity types + updated monster/spell/race/class/background transforms | — |
| T-03 | Add unit tests for all transform functions in T-02 | T-02 |
| T-04 | Write migration: new tables (`srd_feats`, `srd_optional_features`, `srd_languages`, `srd_vehicles`, `srd_traps_hazards`, `srd_loot_tables`) + `ALTER TABLE` to add `source` column to `srd_spells`, `srd_monsters`, `srd_races`, `srd_classes`, `srd_backgrounds` | — |
| T-05 | Write `seed-5etools.ts`: load all fixtures, apply transforms, upsert into new and existing tables | T-02, T-04 |
| T-06 | Wire `seed-5etools.ts` into `docker-compose.yml` entrypoint so it runs on every `docker compose up` | T-05 |
| T-07 | Extend `compendium.ts` routes: add new endpoints + `source` param to existing spells, monsters, races, classes, backgrounds | T-04 |
| T-08 | Write integration tests for all new and modified endpoints | T-07 |
| T-09 | Run `seed:download-5etools`, commit fixtures | T-01 |
| T-10 | Manual smoke test: verify counts and spot-check entries for each category | T-06, T-07 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|---|---|---|---|
| 1 | Should we import fluff (`fluff-feats.json`, etc.) into the `data` JSONB column alongside mechanical data, or skip it? | Team | Resolved | Skip for now; defer to a future spec as an optional enrichment layer. |
| 2 | Do we want to import ALL 101 bestiary source files or a curated subset? | Team | Resolved | Curated subset: MM, VGM, MPMM, MTF, BGDIA, ToA. Covers the most commonly used monsters while keeping fixtures lean. |
| 3 | Should the existing `srd_races`, `srd_classes`, `srd_backgrounds` tables be extended with the full 5etools versions? | Team | Resolved | Yes — extend all three tables with full 5etools 2014 data as part of this spec. |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|---|---|---|---|
| 2026-03-17 | Use 5etools-2014-src as supplemental data source | Broadest coverage of 2014-edition 5e content in structured JSON; aligned with the 2014 ruleset already used by the rest of the app | open5e API (runtime dependency, rate limits), manual entry, 5etools main repo (includes 2024 revised content) |
| 2026-03-17 | Commit fixtures to repo (offline seed) | Consistent with existing SPEC-002 pattern; no network dependency at runtime | Fetch at seed time from GitHub |
| 2026-03-17 | Keep existing SRD fixtures and 5etools fixtures in separate directories | Clear provenance separation; easier to maintain independently | Single merged fixture set |
| 2026-03-17 | Tag all entries with `source` column | Enables filtering by source book (e.g. show only MM monsters, only PHB spells) | No source tracking |
| 2026-03-17 | Curated bestiary subset: MM, VGM, MPMM, MTF, BGDIA, ToA | Covers the most commonly used monsters; keeps fixtures lean; remaining books can be added later | All 101 source files |
| 2026-03-17 | Skip fluff files for now | Mechanical data is sufficient for current use cases; fluff deferred to a future spec | Import fluff into data JSONB |
| 2026-03-17 | Extend srd_races, srd_classes, srd_backgrounds with full 5etools data | Rounds out character builder in one pass alongside the other imports | Separate follow-up spec |

---

## 11. Changelog

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 0.1 | 2026-03-17 | RoleCompanion Team | Initial draft |
| 0.2 | 2026-03-17 | RoleCompanion Team | Resolved open questions: skip fluff (deferred), curated bestiary subset (MM/VGM/MPMM/MTF/BGDIA/ToA), extend races/classes/backgrounds |
