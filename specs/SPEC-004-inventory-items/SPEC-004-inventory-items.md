# Spec: Inventory & Items

**Spec ID:** SPEC-004
**Status:** Draft
**Created:** 2026-03-09
**Last Updated:** 2026-03-09
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec covers each character's inventory: a list of items (from the SRD 2014 equipment tables or created custom), with quantity, weight, currency tracking, attunement slots, and equipment slots (worn/wielded gear).

### 1.2 Problem Statement

Characters accumulate gear throughout a campaign. Without inventory tracking, players use separate spreadsheets or paper notes and lose items, forget their carry weight, and can't track which items they have attuned. This spec gives each character a structured item list integrated with SRD equipment data.

### 1.3 Goals

- [ ] Allow players to add items to their character's inventory (from SRD 2014 equipment/magic items, or as free-text custom entries).
- [ ] Track quantity and weight, with a total carry weight display.
- [ ] Track character currency: platinum, gold, electrum, silver, copper.
- [ ] Support attunement: mark up to 3 items as attuned, enforce the 3-item limit.
- [ ] Support equipment slots: mark items as equipped (worn/wielded).

### 1.4 Non-Goals

- Item crafting or shop mechanics.
- Full custom item creation (SPEC-006).
- Encumbrance rules variants (heavy encumbrance, variant carry weight) — only basic carry weight shown.
- Shared party inventory.

---

## 2. Background & Context

Item data comes from the **5e-database 2014 edition**:

```
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Equipment.json
https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/5e-SRD-Magic-Items.json
```

Key fields: `index`, `name`, `equipment_category`, `cost`, `weight`, `properties` (weapons), `armor_class` (armor), `rarity` (magic items), `requires_attunement`.

Items not in the SRD (custom loot, gifts) can be added as free-text entries with manually set weight and description.

**Related Specs:**
- SPEC-001 — auth and campaigns (required, done).
- SPEC-002 — SRD seeding; `srd_equipment` and `srd_magic_items` tables must exist.
- SPEC-003 — `character_id` FK; characters must exist.
- SPEC-006 — Custom items may be added to inventory.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | A player MUST be able to add an item to their character's inventory, specifying quantity. |
| FR-002 | MUST     | Items MUST be addable from SRD 2014 equipment, SRD magic items, or as a custom free-text entry. |
| FR-003 | MUST     | A player MUST be able to update item quantity and remove items. |
| FR-004 | MUST     | The system MUST track carry weight: sum of (item weight × quantity) across all inventory items. |
| FR-005 | MUST     | The system MUST track character currency in five denominations: pp, gp, ep, sp, cp. |
| FR-006 | MUST     | A player MUST be able to update currency amounts. |
| FR-007 | MUST     | A player MUST be able to mark an item as attuned. |
| FR-008 | MUST     | The system MUST enforce a maximum of 3 attuned items simultaneously. |
| FR-009 | MUST     | A player MUST be able to mark an item as equipped (worn/wielded). |
| FR-010 | SHOULD   | The system SHOULD display total carry weight against the character's carrying capacity (STR score × 15 lbs per 2014 SRD). |
| FR-011 | SHOULD   | The system SHOULD display the full SRD item description when an SRD item is viewed. |
| FR-012 | MAY      | The system MAY support item notes (player annotations on a specific inventory entry). |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Data        | SRD item data MUST come from 5e-database **2014 edition**. |
| NFR-002 | Correctness | Attuned item count MUST never exceed 3. |
| NFR-003 | Performance | Inventory GET MUST respond in under 200ms. |

### 3.3 Constraints

- Only the character's owner may modify inventory and currency.
- All campaign members may read a character's inventory.
- Free-text custom items have no link to the SRD and no auto-filled data.

---

## 4. User Stories

### US-001: Add an Item

**As a** Player,
**I want to** add a longsword from the SRD equipment list to my inventory,
**so that** my sheet reflects the gear I picked up.

**Acceptance Criteria:**
- [ ] AC-001: Given the SRD item `longsword` exists in the seeded data, when I POST it with quantity 1, then it appears in my inventory with weight 3 lb and cost auto-filled from the SRD.
- [ ] AC-002: Given I add the same item again, when I specify quantity 1, then the existing entry's quantity is incremented to 2 (or a new stack is created — TBD in open questions).
- [ ] AC-003: Given I add a free-text item "Mysterious Amulet" with weight 0.1 and quantity 1, then it appears with no SRD link.

---

### US-002: Attune to an Item

**As a** Player,
**I want to** attune to a magic item,
**so that** I can use its properties.

**Acceptance Criteria:**
- [ ] AC-001: Given I have fewer than 3 attuned items, when I mark an item as attuned, then `isAttuned` is true.
- [ ] AC-002: Given I already have 3 attuned items, when I try to attune a 4th, then I receive an error `ATTUNEMENT_SLOTS_FULL`.
- [ ] AC-003: Given I un-attune an item, then my attuned count decreases and I can attune another.

---

### US-003: Track Currency

**As a** Player,
**I want to** record the coins my character is carrying,
**so that** I can track my wealth during the session.

**Acceptance Criteria:**
- [ ] AC-001: Given my character has 0 gp, when I PATCH to set gp to 150, then my inventory shows 150 gp.
- [ ] AC-002: Given I try to set a currency value to a negative number, then I receive a validation error.

---

## 5. Design

### 5.1 Data Model

```typescript
interface InventoryItem {
  id: string;               // UUID
  characterId: string;      // FK → characters.id
  // Item source (exactly one of these is set)
  srdEquipmentIndex: string | null;   // from srd_equipment
  srdMagicItemIndex: string | null;   // from srd_magic_items
  customEntityId: string | null;       // FK → custom_entities.id (SPEC-006)
  // Free-text (used when all above are null)
  customName: string | null;
  customDescription: string | null;
  customWeight: number | null;          // lbs
  // State
  quantity: number;                    // ≥ 1
  isEquipped: boolean;
  isAttuned: boolean;
  notes: string | null;
  addedAt: Date;
}

interface CharacterCurrency {
  characterId: string;    // PK and FK → characters.id (1-to-1)
  pp: number;             // platinum — ≥ 0
  gp: number;             // gold — ≥ 0
  ep: number;             // electrum — ≥ 0
  sp: number;             // silver — ≥ 0
  cp: number;             // copper — ≥ 0
  updatedAt: Date;
}
```

### 5.2 Carry Weight & Capacity

- Carry weight = `SUM(item.weight * item.quantity)` across all inventory items.
  - Weight for SRD items: pulled from `srd_equipment.data->>'weight'`.
  - Weight for custom/free-text items: `customWeight` field.
- Carrying capacity (2014 SRD) = character STR score × 15 lbs.

Both values are computed and returned in the GET response; not stored.

### 5.3 API Design

**`GET /api/v1/characters/:id/inventory`** _(auth, campaign member)_
```json
{
  "items": [
    {
      "id": "...",
      "name": "Longsword",
      "source": "srd_equipment",
      "srdIndex": "longsword",
      "quantity": 1,
      "weight": 3,
      "isEquipped": true,
      "isAttuned": false,
      "cost": "15 gp",
      "notes": null
    },
    {
      "id": "...",
      "name": "Mysterious Amulet",
      "source": "custom",
      "quantity": 1,
      "weight": 0.1,
      "isEquipped": false,
      "isAttuned": true,
      "notes": "Found in the mine"
    }
  ],
  "currency": { "pp": 0, "gp": 150, "ep": 0, "sp": 20, "cp": 5 },
  "carryWeight": 3.1,
  "carryCapacity": 255
}
```

**`POST /api/v1/characters/:id/inventory`** _(auth, character owner)_
```json
// Add SRD item
{ "srdEquipmentIndex": "longsword", "quantity": 1 }
// Add free-text item
{ "customName": "Mysterious Amulet", "customWeight": 0.1, "quantity": 1 }
// Response 201 — the created inventory item
```

**`PATCH /api/v1/characters/:id/inventory/:itemId`** _(auth, character owner)_
```json
// Request
{ "quantity": 2, "isEquipped": true, "isAttuned": false, "notes": "sharpened" }
// Response 200 — updated item
```

**`DELETE /api/v1/characters/:id/inventory/:itemId`** _(auth, character owner)_
```json
// Response 204 No Content
```

**`PUT /api/v1/characters/:id/currency`** _(auth, character owner)_
```json
// Request — full replacement
{ "pp": 0, "gp": 200, "ep": 0, "sp": 15, "cp": 0 }
// Response 200
{ "pp": 0, "gp": 200, "ep": 0, "sp": 15, "cp": 0 }
```

### 5.4 Error Handling

| Error Case | Code | HTTP |
|------------|------|------|
| SRD index not found | `ITEM_NOT_FOUND` | 404 |
| Quantity < 1 | `VALIDATION_ERROR` | 400 |
| Currency value < 0 | `VALIDATION_ERROR` | 400 |
| Attunement limit (3) exceeded | `ATTUNEMENT_SLOTS_FULL` | 409 |
| Non-owner modifies inventory | `FORBIDDEN` | 403 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Carry weight calculation — sum of weight × quantity across items.
- [ ] Carrying capacity — STR score × 15.
- [ ] Attunement limit — cannot exceed 3 attuned items.

### 6.2 Integration Tests

- [ ] Add SRD item → appears in inventory with auto-filled name and weight.
- [ ] Add free-text item → appears with custom name.
- [ ] PATCH quantity to 0 → 400.
- [ ] Attune 3 items → 4th attunement returns 409.
- [ ] Un-attune 1 → can attune another.
- [ ] PUT currency → values persisted.
- [ ] PUT currency with negative gp → 400.
- [ ] Non-owner PATCH → 403.

---

## 7. Security Considerations

- [ ] Inventory is character-scoped; campaign membership is always verified first.
- [ ] Only the character owner may mutate inventory and currency; all campaign members may read.
- [ ] `customDescription` and `notes` are stored as plain text; any HTML is escaped on write.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Drizzle schema: `inventory_items`, `character_currency` | SPEC-003 T-01 |
| T-02 | Migration | T-01 |
| T-03 | `GET /characters/:id/inventory` — joined with SRD data, carry weight computed | SPEC-002, T-02 |
| T-04 | `POST /characters/:id/inventory` — SRD item or free-text | T-03 |
| T-05 | `PATCH /characters/:id/inventory/:itemId` — quantity, equipped, attuned, notes | T-04 |
| T-06 | Attunement guard (max 3) | T-05 |
| T-07 | `DELETE /characters/:id/inventory/:itemId` | T-05 |
| T-08 | `PUT /characters/:id/currency` — upsert character_currency row | T-02 |
| T-09 | Frontend: Inventory tab on character sheet | T-03 |
| T-10 | Frontend: Add item modal (SRD search + free-text) | T-04 |
| T-11 | Frontend: Item row (equipped/attuned toggles, quantity stepper, delete) | T-05–T-07 |
| T-12 | Frontend: Currency tracker (five fields with +/- controls) | T-08 |
| T-13 | Frontend: Carry weight bar | T-03 |
| T-14 | Unit + integration tests | T-03–T-08 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should adding an item already in inventory stack (increment quantity) or create a separate entry? | Team | Open | — |
| 2 | Should equipped items affect AC automatically (e.g., equipping a chain mail sets AC = 16)? | Team | Open | Deferred — SPEC-003 handles AC manually for now |
| 3 | Should electrum (ep) be included? It is in the 2014 SRD but rarely used. | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-09 | Item data from 5e-database **2014 edition** | Consistent with rest of system | Mixed edition |
| 2026-03-09 | Free-text items allowed without SRD link | DMs give players unique loot constantly | SRD-only inventory |
| 2026-03-09 | Carry weight computed on-the-fly, not stored | Avoids stale data; simple to compute | Stored and updated on each mutation |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-09 | RoleCompanion Team | Initial draft |
