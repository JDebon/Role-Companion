# PLAN: SPEC-020 Character Creation Refactor

## Already Done

- `GET /compendium/classes/:index`, `GET /compendium/races/:index`, `GET /compendium/backgrounds/:index` — **implemented** in `apps/api/src/routes/compendium.ts` (FR-011 ✅)

---

## Tasks

### T-01 — DB: `status` column on `characters`

**File:** `packages/db/migrations/0010_character_status.sql`

```sql
ALTER TABLE characters
  ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'
  CHECK (status IN ('draft', 'complete'));
```

Add journal entry to `migrations/meta/_journal.json`.
Update `packages/db/src/schema.ts`: add `status` field to the `characters` table definition.

---

### T-02 — DB: extend `entity_type` enum

**File:** `packages/db/migrations/0011_entity_type_class_race_background.sql`

```sql
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'class';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'race';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'background';
```

> Must be a separate migration file from T-01 because `ALTER TYPE ADD VALUE` cannot run inside a transaction block. Our migrator wraps each file in a transaction — confirm this or split if needed (see Open Question #5 in spec).

Add journal entry. Update `entityTypeEnum` in `packages/db/src/schema.ts`.

---

### T-03 — API: `status` on character create + patch

**File:** `apps/api/src/routes/characters.ts`

- Add `status: z.enum(['draft', 'complete']).optional().default('complete')` to `createSchema`.
- Add `status: z.enum(['draft', 'complete']).optional()` to `patchSchema`.
- In PATCH handler: after fetching the character, reject `complete → draft` with HTTP 400 before applying the update.
- Add `status` to the `INSERT` values in POST handler.
- Add `'status'` to the `scalar` array in PATCH handler so it gets updated.
- Include `status` in the character list response (`GET /campaigns/:id/characters`) alongside existing fields.
- `buildFullSheet` in `character-utils.ts` must also pass `status` through — check if it already does or add it.

---

### T-04 — API: `GET /campaigns/:id/character-options?type=class|race|background`

**File:** `apps/api/src/routes/characters.ts` (add to `campaignCharactersRouter`)

- Require membership (existing `getMembership` helper).
- Validate `type` query param: must be `class | race | background`.
- Query SRD table for that type (`srdClasses` / `srdRaces` / `srdBackgrounds`) — select `index`, `name`.
- Query `customEntities` where `campaignId = :id` AND `entityType = type` — select `id`, `name`, `baseIndex`.
- Return:
  ```json
  {
    "srd": [{ "index": "barbarian", "name": "Barbarian" }],
    "custom": [{ "id": "uuid", "name": "Artificer", "baseIndex": null }]
  }
  ```

---

### T-05 — API tests

**File:** `apps/api/src/tests/characters.test.ts` (extend existing file)

Cover:
- `POST` character with `status: 'draft'` → response has `status: 'draft'`.
- `POST` character without `status` → response has `status: 'complete'`.
- `PATCH` draft → complete succeeds.
- `PATCH` complete → draft returns 400.
- Character list includes `status` on each entry.
- `GET /campaigns/:id/character-options?type=class` returns SRD list.
- `GET /campaigns/:id/character-options?type=class` with a custom entity in the campaign → returns merged list.
- Non-member cannot call character-options endpoint (404).
- Invalid `type` query param → 400.

---

### T-06 — Frontend: types + client

**File:** `apps/web/src/api/client.ts`

- Add `status: 'draft' | 'complete'` to `CharacterSheet` and `CharacterSummary` interfaces.
- Add `characterOptions(campaignId: string, type: 'class' | 'race' | 'background')` API call.
- Add `srdDetail(type: 'classes' | 'races' | 'backgrounds', index: string)` API call (maps to existing compendium endpoints).

---

### T-07 — Frontend: `CharacterCreationPage`

**New file:** `apps/web/src/pages/CharacterCreationPage.tsx`

Layout mirrors `CharacterSheetPage`:
- **Header:** name `<input>` | "Save Draft" button | "Complete Character" button (disabled until name + class + race + maxHp filled).
- **Identity card:** Class `<select>`, Race `<select>`, Background `<select>`, Level `<input>`.
- **Ability Scores card:** six inputs with live modifier display.
- **Combat Stats card:** Max HP, AC, Speed.
- **Saving Throws card:** toggle per ability — auto-checked from class selection.
- **Skill Proficiencies card:** two sections:
  - Class skill picker: "Choose N from [list]" (when class has `proficiency_choices`) — prevents over-selection.
  - Background profs: auto-checked, still toggleable.
- **Backstory & Traits card.**

**Draft/edit mode:**
- On mount, check for `?draft=:characterId` in the URL. If present, `GET /characters/:id` and pre-populate all fields.
- "Save Draft": `POST` on first save → store returned `id` in state; `PATCH` on subsequent saves.
- "Complete Character": validate required fields, PATCH with `status: 'complete'`, redirect to `/characters/:id`.

**Auto-population (on dropdown change):**
1. Call `srdDetail` for SRD options, or look up `baseIndex` for custom options with a base.
2. Class: check saving throw proficiency toggles from `saving_throws`; build skill choice picker from `proficiency_choices`.
3. Race: apply `ability_bonuses` as deltas (tracked in state, reversed on re-selection); set speed from `speed`.
4. Background: check skill profs from `starting_proficiencies`.
5. On selection change, reverse previous auto-applied values before applying new ones.
6. Custom entity with no `baseIndex`: skip auto-population, leave fields as-is.

**Error handling:**
- SRD detail fetch failure: inline toast "Could not load defaults — fill manually"; form stays interactive.
- Character options fetch failure: dropdown shows disabled "Failed to load options".
- Inline errors on save/complete failure — no silent redirect.

---

### T-08 — Frontend: merged dropdown component

Small reusable component used by T-07:

```tsx
<MergedSelect
  type="class"
  campaignId={campaignId}
  value={selected}
  onChange={onSelect}
/>
```

- Fetches `GET /campaigns/:id/character-options?type=...` on mount.
- Renders `<optgroup label="SRD">` and `<optgroup label="Custom">` (omits Custom group if empty).
- Shows `<option disabled>No options available</option>` if both lists are empty.
- Shows `<option disabled>Failed to load options</option>` on fetch error.

---

### T-09 — Frontend: `CampaignPage` — navigate instead of modal

**File:** `apps/web/src/pages/CampaignPage.tsx`

- Change "New Character" button: `onClick={() => navigate(`/campaigns/${id}/characters/new`)}` (remove `setShowCreateChar(true)`).
- Remove the inline create-character modal and its state.
- In the character list, render a "Draft" badge next to characters with `status === 'draft'`.
- For draft characters, link to `/campaigns/:id/characters/new?draft=:characterId` instead of `/characters/:id`.

---

### T-10 — Frontend: read-only identity fields on `CharacterSheetPage`

**File:** `apps/web/src/pages/CharacterSheetPage.tsx`

When `character.status === 'complete'`, render `className`, `raceName`, and `backgroundName` as `<span>` elements (not editable inputs) in the identity/header section.

---

### T-11 — Frontend: route registration

**File:** `apps/web/src/App.tsx`

Add:
```tsx
<Route path="/campaigns/:id/characters/new" element={<ProtectedRoute><CharacterCreationPage /></ProtectedRoute>} />
```

---

## Execution Order

```
T-01 → T-03
T-02 → T-03 (T-02 must land before T-03 uses the enum)
T-03 → T-04 → T-05
T-06 → T-07, T-08, T-09, T-10
T-07 depends on T-08 (dropdown), T-11 (route)
T-09 depends on T-06 (status in CharacterSummary)
T-10 depends on T-06 (status in CharacterSheet)
```

Parallelisable in practice:
- DB (T-01, T-02) and schema (T-03) first.
- API (T-04, T-05) second.
- All frontend tasks (T-06 → T-11) third, once API is done.

---

## Open Issues to Resolve Before Starting

1. **Postgres enum + transaction:** Confirm whether our custom migrator wraps each file in a transaction. If yes, `ALTER TYPE ADD VALUE` must be its own migration file (already planned as T-02 separate from T-01).
2. **Minimum required fields for Complete:** Spec proposes name + class + race + maxHp. Confirm with JDebon (Open Question #3).
3. **Race bonus reversal on change:** When the player changes race, reverse the previously applied `ability_bonuses` before applying the new ones. Confirm this should happen even if the player manually edited the auto-filled values (Open Question #4 analogue for race).
