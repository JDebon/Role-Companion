# RoleCompanion — Feature Tracker

> This document tracks all planned features, their priority, and implementation status.
> Each feature links to its spec once written.

**Last Updated:** 2026-03-09 (Phase 2 specs drafted)

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

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 1 | Auth + Campaign Creation | [SPEC-001](./SPEC-001-auth-campaign/SPEC-001-auth-campaign.md) | MUST | 🟢 Done | User registration, login, campaign management, roles (DM / Player) |
| 2 | SRD Data Seeding + Compendium Search | [SPEC-002](./SPEC-002-srd-seeding/SPEC-002-srd-seeding.md) | MUST | ✏️ Speccing | Import **5e-database 2014 edition** JSON into local DB; search monsters, spells, items |
| 3 | Character Sheet | [SPEC-003](./SPEC-003-character-sheet/SPEC-003-character-sheet.md) | MUST | ✏️ Speccing | Ability scores, HP, AC, skills, saving throws, class features, proficiencies |
| 4 | Inventory & Items | [SPEC-004](./SPEC-004-inventory-items/SPEC-004-inventory-items.md) | MUST | ✏️ Speccing | Item list, weight, currency (gp/sp/cp), attunement, equipment slots |

---

## Phase 2 — Core Gameplay

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 5 | Spell Management | [SPEC-005](./SPEC-005-spell-management/SPEC-005-spell-management.md) | MUST | ✏️ Speccing | Spell slots per level, spells known/prepared, concentration tracker. Uses **5e-database 2014 edition** spell data. |
| 6 | Custom Content (Monsters, Items, Rules) | [SPEC-006](./SPEC-006-custom-content/SPEC-006-custom-content.md) | MUST | ✏️ Speccing | Clone + override SRD 2014 entities or create from scratch; DM-only creation |
| 7 | DM Tools — NPCs & Encounter Tracker | [SPEC-007](./SPEC-007-dm-tools/SPEC-007-dm-tools.md) | MUST | ✏️ Speccing | NPC tracker, 2014 SRD monster stat blocks, HP tracking per encounter, initiative |
| 8 | Notes & Session Logs | [SPEC-008](./SPEC-008-notes-session-logs/SPEC-008-notes-session-logs.md) | MUST | ✏️ Speccing | Per-character notes, shared session summaries, DM-selectively-revealed info |

---

## Phase 3 — Quality of Life

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 9 | Condition Tracker | SPEC-009 | SHOULD | 📋 Planned | Poisoned, stunned, incapacitated, etc. with duration tracking |
| 10 | Death Saves Tracker | SPEC-010 | SHOULD | 📋 Planned | Success/fail tracking, auto-stabilize on 3 successes |
| 11 | Rest Tracker | SPEC-011 | SHOULD | 📋 Planned | Short/long rest resource recovery (HP, spell slots, class features) |
| 12 | Quest / Plot Tracker | SPEC-012 | SHOULD | 📋 Planned | Active quests, objectives, completion status; DM-managed |
| 13 | World Notes | SPEC-013 | SHOULD | 📋 Planned | Locations, factions, lore, image attachments; DM + shared visibility |

---

## Phase 4 — Nice to Have

| # | Feature | Spec | Priority | Status | Notes |
|---|---------|------|----------|--------|-------|
| 14 | Rules Reference | SPEC-014 | MAY | 📋 Planned | Searchable SRD rules, quick-lookup for common mechanics |
| 15 | Realtime Session Mode | SPEC-015 | MAY | 📋 Planned | Live HP updates, initiative order, WebSocket-based; for active play sessions |
| 16 | Campaign Timeline | SPEC-016 | MAY | 📋 Planned | Shared chronological event log visible to all campaign members |

---

## Architecture Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| SRD data source | 5e-database (local seed) | No runtime dependency on external APIs; faster queries; freely extensible |
| Additional content | open5e (optional seed) | Includes third-party OGL content (Kobold Press, etc.) |
| Frontend | React + TypeScript + TanStack Query | Type safety, good ecosystem, familiar |
| Backend | Node.js (Hono) + tRPC | Lightweight, end-to-end type safety |
| Database | PostgreSQL + Drizzle ORM | JSON support for custom content, full-text search |
| Monorepo | pnpm workspaces | Shared packages between web and api apps |
| Custom content model | base_id (FK, nullable) + overrides (JSONB) | Clone SRD entities or create from scratch |
| Auth | JWT | Stateless, simple to implement across monorepo |
