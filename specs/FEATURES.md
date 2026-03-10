# RoleCompanion — Roadmap & Feature Tracker

> **Single source of truth** for project scope, priorities, and implementation status.
> Update this file first when adding, removing, or reprioritizing features.
> Each feature must have a spec before implementation begins.

**Last Updated:** 2026-03-10

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 📋 Planned | Identified, no spec yet |
| ✏️ Speccing | Spec in progress |
| 🔍 Review | Spec under review |
| ✅ Approved | Spec approved, ready to implement |
| 🚧 In Progress | Implementation underway |
| 🟢 Done | Implemented and tested |
| ❌ Dropped | Decided against |

---

## Phase 1 — Foundation

> Core infrastructure: auth, data, characters, items. All done.

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 1 | Auth + Campaign Management | [SPEC-001](./SPEC-001-auth-campaign/SPEC-001-auth-campaign.md) | MUST | 🟢 Done | User registration, login, campaign create/join/manage, DM/Player roles |
| 2 | SRD Compendium | [SPEC-002](./SPEC-002-srd-seeding/SPEC-002-srd-seeding.md) | MUST | 🟢 Done | 5e-database 2014 seeded locally; search spells, monsters, equipment, classes, races |
| 3 | Character Sheet | [SPEC-003](./SPEC-003-character-sheet/SPEC-003-character-sheet.md) | MUST | 🟢 Done | Ability scores, HP, AC, skills, saving throws, proficiencies |
| 4 | Inventory & Items | [SPEC-004](./SPEC-004-inventory-items/SPEC-004-inventory-items.md) | MUST | 🟢 Done | Item list, carry weight, currency (gp/sp/ep/cp), attunement, equipped toggle |

---

## Phase 2 — Core Gameplay

> Spells, combat, and DM tooling. All done except SPEC-008.

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 5 | Spell Management | [SPEC-005](./SPEC-005-spell-management/SPEC-005-spell-management.md) | MUST | 🟢 Done | Spell slots per level, spells known/prepared, concentration tracker |
| 6 | Custom Content | [SPEC-006](./SPEC-006-custom-content/SPEC-006-custom-content.md) | MUST | 🟢 Done | Clone + override SRD entities or create from scratch; DM-only creation |
| 7 | DM Tools — NPCs & Encounter Tracker | [SPEC-007](./SPEC-007-dm-tools/SPEC-007-dm-tools.md) | MUST | 🟢 Done | NPC tracker, monster stat blocks, HP tracking per encounter, initiative order |
| 8 | Notes & Session Logs | [SPEC-008](./SPEC-008-notes-session-logs/SPEC-008-notes-session-logs.md) | MUST | ✅ Approved | Per-character private notes, shared session summaries, DM-selectively-revealed info |

---

## Phase 3 — Quality of Life

> Combat helpers and campaign organisation. Next up.

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 9 | Condition Tracker | SPEC-009 | SHOULD | 📋 Planned | Poisoned, stunned, incapacitated, etc. with duration tracking per combatant |
| 10 | Death Saves Tracker | SPEC-010 | SHOULD | 📋 Planned | Success/fail tracking, auto-stabilize on 3 successes; integrates with combat tracker |
| 11 | Rest Tracker | SPEC-011 | SHOULD | 📋 Planned | Short/long rest resource recovery: HP, spell slots, class features |
| 12 | Quest / Plot Tracker | SPEC-012 | SHOULD | 📋 Planned | Active quests, objectives, completion status; DM-managed, visible to players |
| 13 | World Notes | SPEC-013 | SHOULD | 📋 Planned | Locations, factions, lore; DM + selectively shared visibility |

---

## Phase 4 — Nice to Have

> Lookup tools, realtime play, and campaign history.

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 14 | Rules Reference | SPEC-014 | MAY | 📋 Planned | Searchable SRD rules quick-lookup for common mechanics |
| 15 | Realtime Session Mode | SPEC-015 | MAY | 📋 Planned | Live HP updates, initiative order via WebSocket; for active play sessions |
| 16 | Campaign Timeline | SPEC-016 | MAY | 📋 Planned | Shared chronological event log visible to all campaign members |

---

## Progress Summary

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| Phase 1 — Foundation | 4 | 4 | 0 |
| Phase 2 — Core Gameplay | 4 | 3 | 1 (SPEC-008) |
| Phase 3 — Quality of Life | 5 | 0 | 5 |
| Phase 4 — Nice to Have | 3 | 0 | 3 |
| **Total** | **16** | **7** | **9** |

---

## Workflow

```
1. Pick the next 📋 Planned feature from the roadmap
2. Write a spec → specs/SPEC-XXX-name/SPEC-XXX-name.md
3. Update status to ✅ Approved after review
4. Implement → update status to 🟢 Done
5. Update this file
```

> Only spec the next 1–2 features at a time. Avoid speccing far ahead — requirements change.

---

## Architecture Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| SRD data source | 5e-database 2014 (local seed) | No runtime dependency on external APIs; faster queries; freely extensible |
| Additional content | open5e (optional seed) | Includes third-party OGL content (Kobold Press, etc.) |
| Frontend | React 19 + TypeScript + Tailwind v4 | Type safety, good ecosystem |
| Backend | Hono + TypeScript | Lightweight, fast, type-safe |
| Database | PostgreSQL 17 + Drizzle ORM | JSON support for custom content, full-text search |
| Monorepo | pnpm workspaces | Shared packages between web and api apps |
| Custom content model | base_id (FK, nullable) + overrides (JSONB) | Clone SRD entities or create from scratch |
| Auth | JWT (7-day) | Stateless, simple to implement across monorepo |
| Migrations | Hand-authored SQL + SHA256 hash tracking | Full control; drizzle-kit skips manual migrations without snapshots |
