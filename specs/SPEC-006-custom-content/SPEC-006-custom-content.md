# Spec: Custom Content (Monsters, Items, Rules)

**Spec ID:** SPEC-006
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers the ability for DMs to create custom campaign-scoped content: monsters, items, and rules. Custom entities can be created from scratch or by cloning a 2014 SRD entity and overriding specific fields.

### 1.2 Problem Statement

SRD content covers the baseline rules, but every campaign has homebrew content — custom monsters, house rules, unique magic items. Without a custom content system, DMs are forced to use external tools and can't reference their homebrew directly inside RoleCompanion.

### 1.3 Goals

- [ ] Allow DMs to create custom monsters, items, and rule entries scoped to their campaign.
- [ ] Allow cloning any 2014 SRD entity as a starting point, then overriding fields.
- [ ] Allow DMs to edit and delete their custom content.
- [ ] Make custom content searchable alongside SRD content in the compendium.

### 1.4 Non-Goals

- Player-created content (DM-only in this spec).
- Custom spells (deferred — spells have complex slot/damage mechanics).
- Sharing custom content across campaigns.
- Image uploads (file storage not in scope).

---

## 2. Background & Context

The SRD data source is **5e-database 2014 edition**:

```
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Monsters.json
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Equipment.json
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Magic-Items.json
```

Custom entities store their full data as JSONB, with an optional `base_index` pointing to the SRD entity they were cloned from. This approach was established in the architecture decisions in FEATURES.md.

**Related Specs:**
- SPEC-001 — auth and campaign (required, done).
- SPEC-002 — SRD seeding; base entities must be seeded.
- SPEC-007 — DM Tools uses custom monsters in encounters.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | A DM MUST be able to create a custom monster from scratch within their campaign. |
| FR-002 | MUST     | A DM MUST be able to create a custom item from scratch within their campaign. |
| FR-003 | MUST     | A DM MUST be able to create a custom rule entry (free-form text) within their campaign. |
| FR-004 | MUST     | A DM MUST be able to clone any 2014 SRD monster or item and override specific fields. |
| FR-005 | MUST     | A DM MUST be able to edit any custom entity they created. |
| FR-006 | MUST     | A DM MUST be able to delete any custom entity they created. |
| FR-007 | MUST     | Players MUST be able to view custom content shared by the DM (read-only). |
| FR-008 | SHOULD   | The system SHOULD allow filtering custom content by type (monster / item / rule). |
| FR-009 | MAY      | The system MAY display a diff view showing what fields were overridden from the base SRD entity. |

### 3.2 Non-Functional Requirements

| ID      | Category | Requirement |
|---------|----------|-------------|
| NFR-001 | Data     | Clone source MUST use 5e-database **2014 edition** data exclusively. |
| NFR-002 | Storage  | Custom entity data is stored as JSONB in PostgreSQL, validated against a per-type schema on write. |
| NFR-003 | Isolation | Custom entities are strictly campaign-scoped; they MUST NOT be visible in other campaigns. |

### 3.3 Constraints

- Only the campaign DM may create, edit, or delete custom content.
- The JSONB schema for each type (monster, item, rule) is validated server-side using Zod.

---

## 4. User Stories

### US-001: Create a Custom Monster

**As a** Dungeon Master,
**I want to** create a custom monster for my campaign,
**so that** I can use it in encounters without leaving RoleCompanion.

**Acceptance Criteria:**
- [ ] AC-001: Given I provide a name, CR, HP, AC, and at least one action, when I submit, then the monster is saved and appears in my campaign's custom content list.
- [ ] AC-002: Given I am a player (not DM), when I try to create a monster, then I receive HTTP 403.
- [ ] AC-003: Given I clone the `goblin` SRD monster and change only HP to 10, when I view the custom monster, then all other fields match the original goblin.

---

### US-002: Create a Custom Item

**As a** Dungeon Master,
**I want to** create a custom magic item,
**so that** I can give it to players as a unique reward.

**Acceptance Criteria:**
- [ ] AC-001: Given I provide a name, rarity, and description, when I submit, then the item is saved to my campaign.
- [ ] AC-002: Given I clone an SRD item and rename it, when I view it, then it appears as a custom item under the new name.

---

### US-003: Player Views Custom Content

**As a** Player,
**I want to** view the custom monsters and items my DM has shared,
**so that** I can reference homebrew content during the session.

**Acceptance Criteria:**
- [ ] AC-001: Given the DM created a custom monster, when I (as player) GET the custom content list, then I can see it.
- [ ] AC-002: Given I am not a member of the campaign, when I request custom content, then I receive HTTP 404.

---

## 5. Design

### 5.1 Data Model

```typescript
type EntityType = 'monster' | 'item' | 'rule';

interface CustomEntity {
  id: string;           // UUID
  campaignId: string;   // FK → campaigns.id
  creatorId: string;    // FK → users.id (must be DM)
  entityType: EntityType;
  name: string;         // denormalized for fast listing
  baseIndex: string | null; // SRD 2014 index, e.g. "goblin" — null if created from scratch
  data: Record<string, unknown>; // JSONB, full entity definition
  createdAt: Date;
  updatedAt: Date;
}
```

**JSONB shape per type:**

Monster (mirrors SRD monster fields):
```json
{
  "name": "Cave Troll", "size": "Large", "type": "giant", "alignment": "chaotic evil",
  "armor_class": [{ "type": "natural", "value": 15 }],
  "hit_points": 84, "hit_dice": "8d10+40",
  "speed": { "walk": "30 ft." },
  "strength": 20, "dexterity": 8, "constitution": 20, "intelligence": 4, "wisdom": 9, "charisma": 6,
  "challenge_rating": 5, "xp": 1800,
  "actions": [{ "name": "Claw", "desc": "...", "attack_bonus": 7, "damage": [{ "damage_dice": "2d6+5" }] }],
  "special_abilities": []
}
```

Item:
```json
{
  "name": "Sword of Starlight", "equipment_category": "Weapon",
  "weapon_category": "Martial", "damage": { "damage_dice": "1d8+2", "damage_type": { "name": "Radiant" } },
  "rarity": "rare", "requires_attunement": true, "desc": "..."
}
```

Rule:
```json
{
  "name": "House Rule: Critical Fumble", "desc": "On a natural 1, roll on the fumble table..."
}
```

### 5.2 API Design

**`GET /api/v1/campaigns/:id/custom-content`** _(auth, campaign member)_
```json
// Query params: ?type=monster|item|rule
// Response 200
[
  { "id": "...", "entityType": "monster", "name": "Cave Troll", "baseIndex": null, "createdAt": "..." },
  { "id": "...", "entityType": "item", "name": "Sword of Starlight", "baseIndex": "longsword", "createdAt": "..." }
]
```

**`GET /api/v1/campaigns/:id/custom-content/:entityId`** _(auth, campaign member)_
```json
// Response 200 — full data object
{ "id": "...", "entityType": "monster", "name": "Cave Troll", "baseIndex": null, "data": { ... } }
```

**`POST /api/v1/campaigns/:id/custom-content`** _(auth, DM only)_
```json
// Request
{ "entityType": "monster", "name": "Cave Troll", "baseIndex": null, "data": { ... } }
// Response 201
{ "id": "...", "entityType": "monster", "name": "Cave Troll", "baseIndex": null }
```

**`PATCH /api/v1/campaigns/:id/custom-content/:entityId`** _(auth, DM only)_
```json
// Request — partial update of data fields
{ "name": "Cave Troll (Veteran)", "data": { "hit_points": 100 } }
// Response 200
{ "id": "...", "name": "Cave Troll (Veteran)", "data": { ... } }
```

**`DELETE /api/v1/campaigns/:id/custom-content/:entityId`** _(auth, DM only)_
```json
// Response 204 No Content
```

### 5.3 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| Base SRD index not found | `BASE_NOT_FOUND` | 404 |
| Invalid entity data shape | `VALIDATION_ERROR` | 400 |
| Non-DM tries to mutate | `FORBIDDEN` | 403 |
| Entity not in this campaign | `NOT_FOUND` | 404 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Zod schema validates monster data — rejects missing required fields.
- [ ] Clone from SRD — merged data matches base with overrides applied.

### 6.2 Integration Tests

- [ ] DM creates monster → appears in GET list.
- [ ] Player reads custom content → 200.
- [ ] Player tries to create → 403.
- [ ] DM clones SRD goblin, overrides HP → HP changed, other fields preserved.
- [ ] DM deletes entity → 204, no longer in list.
- [ ] Request from non-member → 404.

---

## 7. Security Considerations

- [ ] `campaignId` is always verified against the authenticated user's membership before reading or writing.
- [ ] `entityType` is an enum — no arbitrary types accepted.
- [ ] JSONB data is validated with Zod before persistence to prevent malformed records.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `custom_entities` table with JSONB `data` column | SPEC-001 T-01 |
| T-02 | Migration | T-01 |
| T-03 | Zod schemas for monster, item, rule data shapes | — |
| T-04 | `GET /custom-content` (list + filter) and `GET /:entityId` | T-02 |
| T-05 | `POST /custom-content` — create from scratch | T-03, T-04 |
| T-06 | Clone from SRD — fetch base entity from seeded data, merge with overrides | SPEC-002, T-05 |
| T-07 | `PATCH` and `DELETE` endpoints | T-05 |
| T-08 | Frontend: Custom content list page | T-04 |
| T-09 | Frontend: Create/edit form (per-type dynamic fields) | T-05, T-07 |
| T-10 | Unit + integration tests | T-03–T-07 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should custom spells be in scope here or deferred entirely? | Team | Open | — |
| 2 | Should custom content be versioned (edit history)? | Team | Open | — |
| 3 | Should players be able to suggest custom items (DM approves)? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | JSONB storage for custom entity data | Flexible schema per entity type; avoids wide EAV tables | Separate typed tables per entity type |
| 2026-03-09 | Clone source is 5e-database **2014 edition** only | Consistent with the rest of the system; 2024 data not yet available | Mixed edition support |
| 2026-03-09 | DM-only creation | Simplest auth model; homebrew is a DM responsibility | Player-proposed content |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
