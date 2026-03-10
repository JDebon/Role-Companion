# Implementation Plan — SPEC-003: Character Sheet

**Spec:** [SPEC-003-character-sheet.md](./SPEC-003-character-sheet.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---

## Task Overview

```
T-01 → T-02 → T-04 → T-09
       T-02 → T-05
T-03 ─────── T-04, T-06
       T-05 → T-06 → T-07 → T-08
T-04–T-08 → T-14
T-05 → T-10
T-04 → T-11
T-06 → T-12
T-07 → T-13
```

---

## Tasks

### T-01 — Schema: characters
**Depends on:** SPEC-001 T-01
**Status:** [ ] Pending

- [ ] `characters` table: id, campaign_id (FK), user_id (FK), name, class_name, subclass_name, race_name, background_name, level, experience_points, str, dex, con, int, wis, cha, max_hp, current_hp, temporary_hp, armor_class, initiative (nullable), speed, skill_proficiencies (JSONB), saving_throw_proficiencies (JSONB), traits (JSONB text[]), backstory (text nullable), portrait_url (varchar nullable), created_at, updated_at.

---

### T-02 — Migration
**Depends on:** T-01
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` and apply.

---

### T-03 — Utility functions
**Depends on:** —
**Status:** [ ] Pending

- [ ] `abilityMod(score)` — `Math.floor((score - 10) / 2)`
- [ ] `proficiencyBonus(level)` — `Math.ceil(level / 4) + 1`
- [ ] `skillBonus(skill, character)` — accounts for proficient / expertise
- [ ] `savingThrowBonus(ability, character)`
- [ ] `carryCapacity(str)` — `str * 15`

---

### T-04 — POST /campaigns/:id/characters
**Depends on:** T-02, T-03
**Status:** [ ] Pending

- [ ] Validate: ability scores 1–30, level 1–20, currentHp ≤ maxHp, maxHp ≥ 0.
- [ ] Initialize `skill_proficiencies` and `saving_throw_proficiencies` with all keys set to `"none"` / `false` if not provided.
- [ ] Return full sheet with derived values.

---

### T-05 — GET /campaigns/:id/characters (list)
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] Campaign membership check.
- [ ] Return summary (id, name, class, race, level, currentHp, maxHp).

---

### T-06 — GET /characters/:id (full sheet)
**Depends on:** T-03, T-05
**Status:** [ ] Pending

- [ ] Verify requester is a campaign member.
- [ ] Compute and return all derived values (modifiers, skill bonuses, saving throws, proficiency bonus).

---

### T-07 — PATCH /characters/:id
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] Owner-only guard.
- [ ] Validate mutated fields (HP bounds, score ranges, etc.).
- [ ] Return updated full sheet.

---

### T-08 — DELETE /characters/:id
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] Owner or DM can delete.
- [ ] Cascade handled by FK constraints on dependent tables.

---

### T-09 — Mount characters router in app.ts
**Depends on:** T-04–T-08
**Status:** [ ] Pending

---

### T-10 — Frontend: Character list on campaign dashboard
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] Cards showing name, class, race, level, HP bar.
- [ ] Link to full sheet view.
- [ ] "New Character" button.

---

### T-11 — Frontend: Create character form
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Multi-step form: basic info → ability scores → HP/AC → proficiencies.
- [ ] Live modifier preview next to each score.

---

### T-12 — Frontend: Character sheet view
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] Ability score block with modifiers.
- [ ] Skills table (bonus + proficiency indicator).
- [ ] Saving throws row.
- [ ] Traits/features list.

---

### T-13 — Frontend: HP tracker
**Depends on:** T-07
**Status:** [ ] Pending

- [ ] Current / max / temp HP display.
- [ ] Quick +/- controls for damage and healing.

---

### T-14 — Unit + integration tests
**Depends on:** T-03–T-08
**Status:** [ ] Pending

- [ ] Unit: all formula functions with edge cases.
- [ ] Integration: all acceptance criteria from SPEC-003.
