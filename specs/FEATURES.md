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

| Task ID | Feature | Spec | Priority | Status | Description |
|---|---------|------|----------|--------|-------|
| 001 | Auth + Campaign Management | [SPEC-001](./SPEC-001-auth-campaign/SPEC-001-auth-campaign.md) | MUST | 🟢 Done | User registration, login, campaign create/join/manage, DM/Player roles |
| 002 | SRD Compendium | [SPEC-002](./SPEC-002-srd-seeding/SPEC-002-srd-seeding.md) | MUST | 🟢 Done | 5e-database 2014 seeded locally; search spells, monsters, equipment, classes, races |
| 003 | Character Sheet | [SPEC-003](./SPEC-003-character-sheet/SPEC-003-character-sheet.md) | MUST | 🟢 Done | Ability scores, HP, AC, skills, saving throws, proficiencies |
| 004 | Inventory & Items | [SPEC-004](./SPEC-004-inventory-items/SPEC-004-inventory-items.md) | MUST | 🟢 Done | Item list, carry weight, currency (gp/sp/ep/cp), attunement, equipped toggle |

---

## Phase 2 — Core Gameplay

> Spells, combat, and DM tooling. All done except SPEC-008.

| Task ID | Feature | Spec | Priority | Status | Description |
|---|---------|------|----------|--------|-------|
| 005 | Spell Management | [SPEC-005](./SPEC-005-spell-management/SPEC-005-spell-management.md) | MUST | 🟢 Done | Spell slots per level, spells known/prepared, concentration tracker |
| 006 | Custom Content | [SPEC-006](./SPEC-006-custom-content/SPEC-006-custom-content.md) | MUST | 🟢 Done | Clone + override SRD entities or create from scratch; DM-only creation |
| 007 | DM Tools — NPCs & Encounter Tracker | [SPEC-007](./SPEC-007-dm-tools/SPEC-007-dm-tools.md) | MUST | 🟢 Done | NPC tracker, monster stat blocks, HP tracking per encounter, initiative order |
| 008 | Notes & Session Logs | [SPEC-008](./SPEC-008-notes-session-logs/SPEC-008-notes-session-logs.md) | MUST | ✅ Approved | Per-character private notes, shared session summaries, DM-selectively-revealed info |
| 022 | Wolrd Setting and Lore | SPEC-009 | MUST | 📋 Planned | Integrating documents (PDF, Docx, .txt, etc.) that can be visited by the characters, DM-selectively-revealed sections and @ to characters |

---

## Phase 3 — Quality of Life

> Combat helpers and campaign organisation. Next up.

| Task ID | Feature | Spec | Priority | Status | Description |
|---|---------|------|----------|--------|-------|
| 009 | Condition Tracker | SPEC-010 | MUST | 📋 Planned | Poisoned, stunned, incapacitated, etc. with duration tracking per combatant |
| 010 | Death Saves Tracker | SPEC-010 | MUST | 📋 Planned | Success/fail tracking, auto-stabilize on 3 successes; integrates with combat tracker |
| 011 | Rest Tracker | SPEC-011 | SHOULD | 📋 Planned | Short/long rest resource recovery: HP, spell slots, class features |
| 014 | Spell Slots Tracker | SPEC-012 | MUST | 📋 Planned | Amount of Spell Slots the character has by level; integrate an optional feature to change the display to Spell Points rule if needed |
| 020 | Reveal to Player | SPEC-013 | MUST | 📋 Planned | The DM notes must now have a button or option to reveal a note only for a selected player or players, and not only a button to reveal for all the party |

---

## Phase 4 — Nice to Have

> Lookup tools, realtime play, and campaign history.

| Task ID | Feature | Spec | Priority | Status | Description |
|---|---------|------|----------|--------|-------|
| 013 | World Notes | SPEC-013 | SHOULD | 📋 Planned | Locations, factions, lore; DM + selectively shared visibility |
| 012 | Quest / Plot Tracker | SPEC-013 | SHOULD | 📋 Planned | Active quests, objectives, completion status; DM-managed, visible to players |
| 015 | Rules Reference | SPEC-015 | SHOULD | 📋 Planned | Searchable SRD rules quick-lookup for common mechanics |
| 016 | Realtime Session Mode | SPEC-016 | MAY | 📋 Planned | Live HP updates, initiative order via WebSocket; for active play sessions |
| 017 | Campaign Timeline | SPEC-017 | MAY | 📋 Planned | Shared chronological event log visible to all campaign members |
| 019 | Sorting Databases | SPEC-014 | MUST | 📋 Planned | Must sort all items, monsters, etc. by book these come from (ex. Player's Handbook, Dungeon Master's Guide, Xanathar's Guide to Everiting, etc.) |
| 018 | Custom Rules | SPEC-018 | MAY | 📋 Planned | Display a check-list with all the availabe books and rules for the player or dm to enable or disable, alowing the dm to show or use specific content |
| 021 | New Rules Integration | SPEC-019 | SHOULD | 📋 Planned | Developing a system to integrate new functionalities corresponding to settings or rulebooks that are not part of the original SRD (ex. Durability Mechanics, Special Attacks, etc.) |

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