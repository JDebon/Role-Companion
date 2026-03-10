# Implementation Plan — SPEC-007: DM Tools — NPCs & Encounter Tracker

**Spec:** [SPEC-007-dm-tools.md](./SPEC-007-dm-tools.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-03 → T-04 → T-05 → T-06
                             T-05 → T-07
T-02 → T-08
T-03–T-08 → T-12
T-03 → T-09
T-05–T-07 → T-10
T-08 → T-11
```

---

## Tasks

### T-01 — Schema: encounters, combatants, npcs
**Depends on:** SPEC-001 T-01
**Status:** [ ] Pending

- [ ] `encounters`: id, campaign_id (FK), name, status (enum: preparing|active|completed), current_turn_index, round, created_at, updated_at.
- [ ] `combatants`: id, encounter_id (FK), type (enum), character_id (nullable FK), monster_index (nullable), custom_entity_id (nullable FK), npc_id (nullable FK), display_name, max_hp, current_hp, armor_class, initiative (nullable), is_unconscious, sort_order.
- [ ] `npcs`: id, campaign_id (FK), name, monster_index (nullable), custom_entity_id (nullable FK), notes, created_at, updated_at.

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — Encounter CRUD
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /campaigns/:id/encounters` — list with status and combatant count.
- [ ] `POST /campaigns/:id/encounters` — create in `preparing` state, round = 1.
- [ ] `GET /campaigns/:id/encounters/:encId` — full state with sorted combatants.
- [ ] `DELETE /campaigns/:id/encounters/:encId` — DM only.

---

### T-04 — Add combatants endpoint
**Depends on:** SPEC-002, T-03
**Status:** [ ] Pending

- [ ] Accept type: srd_monster (with count), player_character, custom_monster, npc.
- [ ] For srd_monster: look up 2014 SRD data for HP, AC; auto-number display names ("Goblin 1", "Goblin 2", ...).
- [ ] For player_character: pull max HP and AC from character sheet.
- [ ] Guard: only allowed in `preparing` status.

---

### T-05 — Start encounter (initiative → sort)
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Accept array of `{ combatantId, initiative }`.
- [ ] Set sort_order per combatant (descending by initiative, ties broken by dexterity modifier for monsters).
- [ ] Set encounter status to `active`, current_turn_index = 0.

---

### T-06 — HP delta endpoint
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] `POST /combatants/:combId/hp` with `{ delta }`.
- [ ] Clamp: `max(0, min(maxHp, currentHp + delta))`.
- [ ] Set `isUnconscious = true` when currentHp reaches 0.

---

### T-07 — Next turn + end encounter
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] `POST /encounters/:encId/next-turn`: advance current_turn_index, skip unconscious, increment round when wrapping.
- [ ] `POST /encounters/:encId/end`: set status = `completed`.
- [ ] `POST /encounters/:encId/reset`: restore all combatant HP to max, clear initiative, set status = `preparing`.

---

### T-08 — NPC CRUD
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] `GET /campaigns/:id/npcs` — DM + members can list.
- [ ] `POST /campaigns/:id/npcs` — DM only; with optional SRD monster base.
- [ ] `PATCH /campaigns/:id/npcs/:npcId` — DM only.
- [ ] `DELETE /campaigns/:id/npcs/:npcId` — DM only.

---

### T-09 — Frontend: Encounter list + create
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] Campaign sub-page listing all encounters with status badge.
- [ ] Create encounter modal (name input).

---

### T-10 — Frontend: Encounter runner
**Depends on:** T-05–T-07
**Status:** [ ] Pending

- [ ] Two-panel layout: initiative order (left) + combatant detail (right).
- [ ] HP bar with +/- damage/heal controls.
- [ ] "Next Turn" button; active combatant highlighted.
- [ ] Unconscious combatants shown with strikethrough.

---

### T-11 — Frontend: NPC management page
**Depends on:** T-08
**Status:** [ ] Pending

- [ ] List of campaign NPCs.
- [ ] Create NPC form with SRD monster search.
- [ ] Edit / delete NPC from list.

---

### T-12 — Tests
**Depends on:** T-03–T-08
**Status:** [ ] Pending

- [ ] Unit: HP clamping, initiative sorting, turn advancement.
- [ ] Integration: all acceptance criteria from SPEC-007.
