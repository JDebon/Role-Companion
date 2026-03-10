# Spec: DM Tools — NPCs & Encounter Tracker

**Spec ID:** SPEC-007
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers the DM's encounter management tools: creating and running combat encounters with initiative tracking, HP tracking per combatant, and NPC management within a campaign.

### 1.2 Problem Statement

Running combat in D&D 5e requires the DM to track initiative order, HP for each creature, and conditions — all simultaneously. Without tooling, DMs juggle spreadsheets, paper notes, and memory. This spec gives the DM a structured encounter tracker integrated with the campaign's character and custom content data.

### 1.3 Goals

- [ ] Allow the DM to create encounters and add combatants (player characters, SRD monsters, or custom monsters).
- [ ] Track initiative order and current HP for each combatant.
- [ ] Allow the DM to apply damage or healing to any combatant.
- [ ] Show the encounter state (who's next, HP, alive/dead) clearly.
- [ ] Allow the DM to manage reusable NPCs (named characters not tied to a single encounter).

### 1.4 Non-Goals

- Automated attack rolls or damage calculation.
- Condition tracking (SPEC-009).
- Player-visible encounter view (DM-only for now; sharing is a stretch goal).
- Map or grid combat.

---

## 2. Background & Context

Monster stat blocks come from the **5e-database 2014 edition**:

```
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Monsters.json
```

Key monster fields used in this spec: `name`, `hit_points`, `armor_class`, `challenge_rating`, `actions`, `special_abilities`, `speed`, all ability scores, `senses`, `languages`.

Custom monsters (SPEC-006) can also be added as combatants and follow the same data shape.

**Related Specs:**
- SPEC-001 — auth and campaigns (required, done).
- SPEC-002 — SRD seeding; monster stat blocks must be seeded.
- SPEC-003 — character sheet; player characters are combatants.
- SPEC-006 — custom monsters usable in encounters.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | The DM MUST be able to create an encounter with a name within a campaign. |
| FR-002 | MUST     | The DM MUST be able to add combatants to an encounter: player characters, SRD monsters, or custom monsters. |
| FR-003 | MUST     | The DM MUST be able to set an initiative roll for each combatant. |
| FR-004 | MUST     | The system MUST sort combatants by initiative (descending) and display the ordered list. |
| FR-005 | MUST     | The DM MUST be able to apply damage or healing to any combatant, clamped between 0 and max HP. |
| FR-006 | MUST     | The system MUST mark a combatant as unconscious when their HP reaches 0. |
| FR-007 | MUST     | The DM MUST be able to advance the turn to the next combatant (circular order, skipping unconscious). |
| FR-008 | MUST     | The DM MUST be able to end an encounter (sets status to `completed`). |
| FR-009 | MUST     | The DM MUST be able to manage campaign NPCs: create, name, assign a stat block (SRD or custom), and add notes. |
| FR-010 | SHOULD   | The DM SHOULD be able to add multiple instances of the same monster (e.g. "Goblin 1", "Goblin 2") automatically numbered. |
| FR-011 | SHOULD   | The DM SHOULD be able to reset an encounter (restore all HP, clear initiative) to run it again. |
| FR-012 | MAY      | The DM MAY duplicate a past encounter as a template for a new one. |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Data        | Monster stat blocks MUST use 5e-database **2014 edition** data. |
| NFR-002 | Performance | Encounter state updates (damage/heal) MUST respond in under 200ms. |
| NFR-003 | Correctness | HP MUST be clamped: `0 ≤ currentHp ≤ maxHp`. |

### 3.3 Constraints

- Encounter data is scoped to a campaign and accessible only to its DM (and optionally read by players in a future spec).
- SRD monsters are referenced by index, not copied, to avoid data duplication.

---

## 4. User Stories

### US-001: Run a Combat Encounter

**As a** Dungeon Master,
**I want to** set up and run a combat encounter with initiative tracking and HP,
**so that** I can manage combat without juggling external tools.

**Acceptance Criteria:**
- [ ] AC-001: Given I create an encounter called "Goblin Ambush", when I add 3 goblins (from SRD) and 2 player characters, then all 5 appear as combatants.
- [ ] AC-002: Given I set initiative values and click "Start", then combatants are sorted highest-to-lowest and the first is marked as "active turn".
- [ ] AC-003: Given the active combatant takes 7 damage, when I apply it, then their HP decreases by 7 immediately.
- [ ] AC-004: Given a goblin reaches 0 HP, then it is marked unconscious and skipped in the turn order.

---

### US-002: Manage NPCs

**As a** Dungeon Master,
**I want to** maintain a list of named NPCs for my campaign,
**so that** I can quickly add recurring characters to encounters.

**Acceptance Criteria:**
- [ ] AC-001: Given I create an NPC named "Mirtala the Innkeeper" with a `commoner` stat block, then she appears in my campaign NPC list.
- [ ] AC-002: Given I add Mirtala to an encounter, then her max HP and AC are pre-filled from the `commoner` stat block.
- [ ] AC-003: Given I have no DM role, when I try to create an NPC, then I receive HTTP 403.

---

## 5. Design

### 5.1 Data Model

```typescript
type EncounterStatus = 'preparing' | 'active' | 'completed';
type CombatantType = 'player_character' | 'srd_monster' | 'custom_monster' | 'npc';

interface Encounter {
  id: string;               // UUID
  campaignId: string;       // FK → campaigns.id
  name: string;
  status: EncounterStatus;
  currentTurnIndex: number; // index into sorted combatants array
  round: number;            // current round number
  createdAt: Date;
  updatedAt: Date;
}

interface Combatant {
  id: string;               // UUID
  encounterId: string;      // FK → encounters.id
  type: CombatantType;
  // Reference: ONE of these is set depending on type
  characterId: string | null;   // FK → characters.id
  monsterIndex: string | null;  // SRD 2014 index e.g. "goblin"
  customEntityId: string | null; // FK → custom_entities.id
  npcId: string | null;         // FK → npcs.id
  // Encounter-specific state
  displayName: string;      // e.g. "Goblin 2" (may differ from source name)
  maxHp: number;
  currentHp: number;
  armorClass: number;
  initiative: number | null; // null until set
  isUnconscious: boolean;
  sortOrder: number;        // derived from initiative, set on encounter start
}

interface NPC {
  id: string;               // UUID
  campaignId: string;       // FK → campaigns.id
  name: string;
  monsterIndex: string | null;  // SRD 2014 base stat block
  customEntityId: string | null; // Custom monster base
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 API Design

#### Encounters

**`GET /api/v1/campaigns/:id/encounters`** _(auth, DM)_
```json
[{ "id": "...", "name": "Goblin Ambush", "status": "active", "round": 2, "combatantCount": 5 }]
```

**`POST /api/v1/campaigns/:id/encounters`** _(auth, DM)_
```json
// Request
{ "name": "Goblin Ambush" }
// Response 201
{ "id": "...", "name": "Goblin Ambush", "status": "preparing", "round": 1 }
```

**`GET /api/v1/campaigns/:id/encounters/:encId`** _(auth, DM)_
```json
{
  "id": "...", "name": "Goblin Ambush", "status": "active", "round": 2,
  "currentTurnIndex": 1,
  "combatants": [
    { "id": "...", "displayName": "Thorn (PC)", "type": "player_character", "initiative": 18, "currentHp": 22, "maxHp": 28, "armorClass": 16, "isUnconscious": false },
    { "id": "...", "displayName": "Goblin 1", "type": "srd_monster", "monsterIndex": "goblin", "initiative": 14, "currentHp": 0, "maxHp": 7, "armorClass": 15, "isUnconscious": true }
  ]
}
```

**`POST /api/v1/campaigns/:id/encounters/:encId/combatants`** _(auth, DM)_
```json
// Request — add SRD monster
{ "type": "srd_monster", "monsterIndex": "goblin", "count": 3 }
// Request — add player character
{ "type": "player_character", "characterId": "..." }
// Response 201 — array of created combatants
[{ "id": "...", "displayName": "Goblin 1", "maxHp": 7, "armorClass": 15 }, ...]
```

**`POST /api/v1/campaigns/:id/encounters/:encId/start`** _(auth, DM)_
```json
// Request — initiative values per combatant
{ "initiatives": [{ "combatantId": "...", "initiative": 18 }, ...] }
// Response 200 — encounter with sorted combatants
```

**`POST /api/v1/campaigns/:id/encounters/:encId/combatants/:combId/hp`** _(auth, DM)_
```json
// Request
{ "delta": -7 }   // negative = damage, positive = healing
// Response 200
{ "combatantId": "...", "currentHp": 0, "isUnconscious": true }
```

**`POST /api/v1/campaigns/:id/encounters/:encId/next-turn`** _(auth, DM)_
```json
// Response 200
{ "currentTurnIndex": 2, "round": 2, "activeCombatant": { "id": "...", "displayName": "Goblin 2" } }
```

**`POST /api/v1/campaigns/:id/encounters/:encId/end`** _(auth, DM)_
```json
// Response 200
{ "status": "completed" }
```

#### NPCs

**`GET /api/v1/campaigns/:id/npcs`** _(auth, campaign member)_
**`POST /api/v1/campaigns/:id/npcs`** _(auth, DM)_
**`PATCH /api/v1/campaigns/:id/npcs/:npcId`** _(auth, DM)_
**`DELETE /api/v1/campaigns/:id/npcs/:npcId`** _(auth, DM)_

### 5.3 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Monster index not found in SRD 2014 | `MONSTER_NOT_FOUND` | 404 |
| Encounter not in `preparing` state when adding combatants | `ENCOUNTER_ALREADY_STARTED` | 409 |
| HP delta would go below 0 or above max | clamped silently | — |
| Non-DM mutates encounter | `FORBIDDEN` | 403 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] HP clamping — damage never pushes HP below 0; healing never exceeds max.
- [ ] Initiative sorting — combatants sorted descending by initiative.
- [ ] Turn advancement — skips unconscious combatants, wraps around on new round.

### 6.2 Integration Tests

- [ ] Create encounter → add 3 goblins (numbered auto) + 1 PC → start → sorted order.
- [ ] Apply damage → HP decremented, unconscious flag set at 0.
- [ ] Next turn → advances index, skips unconscious.
- [ ] End encounter → status = completed.
- [ ] Create NPC with SRD base → HP/AC pre-filled.
- [ ] Player tries to create encounter → 403.

---

## 7. Security Considerations

- [ ] Only the campaign DM may create, modify, or end encounters.
- [ ] Players may read encounter data only after a future "reveal" feature (out of scope here).
- [ ] All monster data is pulled from seeded SRD 2014 data — no user-supplied stat blocks beyond custom entities (SPEC-006).

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `encounters`, `combatants`, `npcs` | SPEC-001 T-01 |
| T-02 | Migration | T-01 |
| T-03 | Encounter CRUD endpoints | T-02 |
| T-04 | Add combatants endpoint (SRD lookup + auto-naming) | SPEC-002, T-03 |
| T-05 | Start encounter (initiative input → sort order) | T-04 |
| T-06 | HP delta endpoint (damage/heal with clamping) | T-05 |
| T-07 | Next-turn + end-encounter endpoints | T-05 |
| T-08 | NPC CRUD endpoints | T-02 |
| T-09 | Frontend: Encounter list + create | T-03 |
| T-10 | Frontend: Encounter runner (initiative, HP bars, turn indicator) | T-05–T-07 |
| T-11 | Frontend: NPC management page | T-08 |
| T-12 | Unit + integration tests | T-03–T-08 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should players see the encounter board in real time (WebSocket)? | Team | Open | Deferred to SPEC-015 |
| 2 | Should legendary actions get their own turn entries? | Team | Open | — |
| 3 | Should HP be secret (DM-only) or visible to all players? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Monster data from 5e-database **2014 edition** (`/src/2014/5e-SRD-Monsters.json`) | Matches the players' ruleset | Mixed editions |
| 2026-03-09 | Reference SRD monsters by index, copy HP/AC into combatant row | Allows stat edits per-combatant without mutating SRD data | Full denormalization |
| 2026-03-09 | DM-only encounter access (no player view) | Simplest first pass; SPEC-015 adds live sharing | Shared encounter board from day one |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
