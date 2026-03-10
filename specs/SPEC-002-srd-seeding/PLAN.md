# Implementation Plan — SPEC-002: SRD Data Seeding + Compendium Search

**Spec:** [SPEC-002-srd-seeding.md](./SPEC-002-srd-seeding.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-03 → T-04 → T-05
                             T-06
              T-02 → T-07 → T-11
              T-02 → T-08 → T-11
              T-02 → T-09 → T-11
              T-02 → T-10 → T-11
T-03–T-10 → T-12
```

---

## Tasks

### T-01 — Schema: all srd_* tables
**Depends on:** SPEC-001 T-01
**Status:** [ ] Pending

- [ ] `srd_spells`: index (PK), name, level (int), school (varchar), concentration (bool), ritual (bool), classes (text[]), data (JSONB)
- [ ] `srd_monsters`: index (PK), name, challenge_rating (numeric), monster_type (varchar), size (varchar), data (JSONB)
- [ ] `srd_equipment`: index (PK), name, equipment_category (varchar), weapon_category (nullable varchar), data (JSONB)
- [ ] `srd_magic_items`: index (PK), name, rarity (varchar), data (JSONB)
- [ ] Generic tables (index PK, name, data JSONB): `srd_classes`, `srd_races`, `srd_backgrounds`, `srd_conditions`, `srd_skills`, `srd_damage_types`, `srd_magic_schools`, `srd_weapon_properties`

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — Seed script (`packages/db/src/seed.ts`)
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] Fetch each JSON file from `https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-{Collection}.json`.
- [ ] Transform functions per collection (extract denormalized columns).
- [ ] Upsert via `INSERT … ON CONFLICT (index) DO UPDATE SET …`.
- [ ] Log progress per collection (e.g., "Seeded 319 spells").

---

### T-04 — Add "seed" script to package.json
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] `"seed": "tsx src/seed.ts"` in `packages/db/package.json`.
- [ ] `"seed"` command added to root `package.json` scripts.

---

### T-05 — Run seed against dev DB; verify row counts
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Run seed and confirm: ~319 spells, ~334 monsters, ~237 equipment entries.
- [ ] Run again — confirm 0 new rows (idempotence).

---

### T-06 — Add seed step to docker-compose.test.yml
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Update `api-test` entrypoint to run `pnpm --filter @rolecompanion/db seed` after migration.

---

### T-07 — Compendium: spells endpoints
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /api/v1/compendium/spells` with `?q=`, `?level=`, `?school=`, `?class=`, pagination.
- [ ] `GET /api/v1/compendium/spells/:index` — return `data` JSONB.
- [ ] Both require JWT (authMiddleware).

---

### T-08 — Compendium: monsters endpoints
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /api/v1/compendium/monsters` with `?q=`, `?cr=`, `?type=`, pagination.
- [ ] `GET /api/v1/compendium/monsters/:index`.

---

### T-09 — Compendium: equipment endpoints
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /api/v1/compendium/equipment` with `?q=`, `?category=`, pagination.
- [ ] `GET /api/v1/compendium/equipment/:index`.

---

### T-10 — Compendium: generic collection endpoints
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /api/v1/compendium/:collection` for classes, races, backgrounds, conditions, skills (with `?q=`).
- [ ] Return 404 for unknown collection names.

---

### T-11 — Mount compendium router in app.ts
**Depends on:** T-07–T-10
**Status:** [ ] Pending

- [ ] `app.route('/api/v1/compendium', compendiumRouter)`

---

### T-12 — Unit + integration tests
**Depends on:** T-03–T-10
**Status:** [ ] Pending

- [ ] Unit: transform functions produce correct denormalized fields.
- [ ] Integration: all acceptance criteria from SPEC-002 (search, filters, 404 on unknown index, 401 without JWT, seed idempotence).
