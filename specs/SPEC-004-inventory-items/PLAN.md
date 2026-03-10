# Implementation Plan — SPEC-004: Inventory & Items

**Spec:** [SPEC-004-inventory-items.md](./SPEC-004-inventory-items.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-03 → T-04 → T-05 → T-06
                      T-04 → T-07
              T-02 → T-08
T-03–T-08 → T-14
T-03 → T-09
T-04 → T-10
T-05–T-07 → T-11
T-08 → T-12
T-03 → T-13
```

---

## Tasks

### T-01 — Schema: inventory_items, character_currency
**Depends on:** SPEC-003 T-01
**Status:** [ ] Pending

- [ ] `inventory_items`: id, character_id (FK), srd_equipment_index (nullable), srd_magic_item_index (nullable), custom_entity_id (nullable FK), custom_name (nullable), custom_description (nullable), custom_weight (nullable numeric), quantity (int, ≥ 1), is_equipped (bool), is_attuned (bool), notes (nullable text), added_at.
- [ ] `character_currency`: character_id (PK, FK), pp, gp, ep, sp, cp (all int ≥ 0, default 0), updated_at.
- [ ] Check constraint: exactly one of (srd_equipment_index, srd_magic_item_index, custom_entity_id, custom_name) must be non-null per row.

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — GET /characters/:id/inventory
**Depends on:** SPEC-002, T-02
**Status:** [ ] Pending

- [ ] Join with `srd_equipment` or `srd_magic_items` to get name and weight for SRD items.
- [ ] Compute carry weight (SUM of weight × quantity).
- [ ] Return carrying capacity from character's STR score.
- [ ] Include currency (upsert default row if missing).

---

### T-04 — POST /characters/:id/inventory
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] Accept `srdEquipmentIndex`, `srdMagicItemIndex`, `customEntityId`, or free-text fields.
- [ ] Validate SRD index exists in seeded data (404 if not).
- [ ] Validate quantity ≥ 1.
- [ ] Owner-only guard.

---

### T-05 — PATCH /characters/:id/inventory/:itemId
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Allow updating: quantity, isEquipped, isAttuned, notes, customDescription.
- [ ] Reject quantity < 1.
- [ ] Owner-only guard.

---

### T-06 — Attunement guard
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] On `isAttuned: true`, count existing attuned items for character.
- [ ] Return `ATTUNEMENT_SLOTS_FULL` (409) if already 3 attuned.

---

### T-07 — DELETE /characters/:id/inventory/:itemId
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Owner-only guard.
- [ ] Return 204.

---

### T-08 — PUT /characters/:id/currency
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] Upsert `character_currency` row.
- [ ] Validate all values ≥ 0.
- [ ] Owner-only guard.

---

### T-09 — Frontend: Inventory tab on character sheet
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] Table of items: name, qty, weight, equipped badge, attuned badge.
- [ ] Carry weight progress bar (current / capacity).

---

### T-10 — Frontend: Add item modal
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Tabs: "SRD Equipment" (search), "SRD Magic Items" (search), "Custom" (free-text).
- [ ] Quantity input.

---

### T-11 — Frontend: Item row controls
**Depends on:** T-05–T-07
**Status:** [ ] Pending

- [ ] Quantity stepper (+/-).
- [ ] Equipped toggle.
- [ ] Attuned toggle (disabled + tooltip if at 3).
- [ ] Delete button with confirmation.

---

### T-12 — Frontend: Currency tracker
**Depends on:** T-08
**Status:** [ ] Pending

- [ ] Five coin fields (pp, gp, ep, sp, cp) with inline edit.
- [ ] Gold equivalent total shown beneath.

---

### T-13 — Frontend: Carry weight bar
**Depends on:** T-03
**Status:** [ ] Pending

- [ ] Progress bar: carry weight / carrying capacity.
- [ ] Colour-coded (green → yellow → red) as weight increases.

---

### T-14 — Unit + integration tests
**Depends on:** T-03–T-08
**Status:** [ ] Pending

- [ ] Unit: carry weight sum, carrying capacity formula, attunement count guard.
- [ ] Integration: all acceptance criteria from SPEC-004.
