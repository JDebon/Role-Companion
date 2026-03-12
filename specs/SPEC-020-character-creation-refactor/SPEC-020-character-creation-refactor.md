# Spec: Character Creation Refactor

**Spec ID:** SPEC-020
**Status:** Draft
**Created:** 2026-03-12
**Last Updated:** 2026-03-12
**Author:** RoleCompanion Team
**Reviewers:** —

---

## 1. Overview

### 1.1 Summary

This spec refactors the character creation flow from a minimal inline form into a dedicated multi-step page. The new flow uses SRD data for class, race, and background selection with guided defaults — giving players a more complete and accurate character creation experience.

### 1.2 Problem Statement

The current "New Character" button opens a simple form that accepts free-text class, race, and background names. Players must know valid 5e names from memory, can mistype them, and receive no guidance on starting attributes or proficiencies. This creates incomplete characters and poor onboarding for new players. Since SRD class, race, and background data is already seeded (SPEC-002), the app can provide selector-driven creation with helpful defaults.

### 1.3 Goals

- [ ] Replace the inline "New Character" form with a dedicated creation tab/page.
- [ ] Provide dropdown selectors for class, race, and background driven by the SRD tables.
- [ ] Auto-suggest starting stats based on selected class (e.g., primary ability score, hit die).
- [ ] Preserve the ability to create characters with custom (free-text) class/race/background names for homebrew.
- [ ] Keep the creation flow completable in a single session without requiring multi-step save state.

### 1.4 Non-Goals

- Full character builder with automatic proficiency and feature population — deferred.
- Multiclassing during creation — deferred.
- Point-buy or standard array stat generation — deferred (manual entry only in this spec).
- Automated level-up flow — deferred.

---

## 2. Background & Context

SPEC-003 established the character data model and a basic creation form. The underlying data model (`characters` table) does not change in this spec — only the UI flow and the UX of populating it changes. The SRD tables (`srd_classes`, `srd_races`, `srd_backgrounds`) are already available via the compendium API (SPEC-002).

**Related Specs:**
- SPEC-001 — Auth & Campaign Management (campaign and user context).
- SPEC-002 — SRD Compendium (source of class, race, background data for selectors).
- SPEC-003 — Character Sheet (data model and existing creation endpoint being improved here).

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Priority | Requirement |
|--------|----------|-------------|
| FR-001 | MUST     | The "New Character" button MUST navigate the user to a dedicated character creation page/tab rather than opening an inline modal or form. |
| FR-002 | MUST     | The creation page MUST provide a searchable dropdown selector for class, populated from `srd_classes`. |
| FR-003 | MUST     | The creation page MUST provide a searchable dropdown selector for race, populated from `srd_races`. |
| FR-004 | MUST     | The creation page MUST provide a searchable dropdown selector for background, populated from `srd_backgrounds`. |
| FR-005 | MUST     | The user MUST be able to type a custom (free-text) value in each selector to support homebrew class/race/background names. |
| FR-006 | MUST     | The creation page MUST include fields for character name, level, ability scores, max HP, AC, and speed. |
| FR-007 | SHOULD   | When a class is selected from the SRD, the form SHOULD display that class's hit die and primary ability score as a hint to guide HP and stat entry. |
| FR-008 | SHOULD   | When a race is selected from the SRD, the form SHOULD display any ability score bonuses as hints. |
| FR-009 | MUST     | Submitting the form MUST call `POST /api/v1/campaigns/:id/characters` and redirect the user to the new character sheet on success. |
| FR-010 | MUST     | Validation errors from the API MUST be displayed inline next to the relevant fields. |
| FR-011 | MUST     | A "Cancel" button MUST navigate back to the campaign dashboard without creating a character. |

### 3.2 Non-Functional Requirements

| ID      | Category    | Requirement |
|---------|-------------|-------------|
| NFR-001 | Performance | SRD selector data MUST load within 500ms; selectors MUST NOT block form interaction while loading. |
| NFR-002 | UX          | The creation page MUST be usable on mobile viewports (responsive layout). |
| NFR-FE  | Frontend Errors | API errors MUST be displayed as inline messages. Pages MUST NOT silently redirect on error. Only redirect on confirmed 401/403. |

### 3.3 Constraints

- The underlying `POST /api/v1/campaigns/:id/characters` API endpoint is unchanged.
- No new database tables or migrations are required for this spec.
- SRD selector values are informational hints only; the character is stored with the user-provided (or selected) free-text name.

---

## 4. User Stories

### US-001: Player Selects a Class from SRD

**As a** Player creating a new character,
**I want to** pick my class from a dropdown of SRD classes,
**so that** I don't have to remember exact class names or spellings.

**Acceptance Criteria:**
- [ ] AC-001: Given I open the character creation page, when I click the class selector, I see a list of all SRD classes (e.g., Barbarian, Bard, Cleric…).
- [ ] AC-002: Given I type "war" in the class selector, the list filters to show "Warlock" and "Wizard".
- [ ] AC-003: Given I type "Artificer" (not in base SRD), I can confirm the custom text and proceed.
- [ ] AC-004: Given I select "Fighter", the form shows a hint: "Hit Die: d10 | Primary: STR or DEX".

---

### US-002: Player Selects Race and Background

**As a** Player,
**I want to** select race and background from SRD dropdowns,
**so that** I can create a valid character quickly without referencing external sources.

**Acceptance Criteria:**
- [ ] AC-001: Given I select "Half-Elf" from the race selector, the form shows a hint: "Ability Score Bonuses: CHA +2, two others +1".
- [ ] AC-002: Given I select "Soldier" from the background selector, the form confirms my selection.
- [ ] AC-003: Given I type a custom background name and confirm it, the character is created with that value.

---

### US-003: Player Completes and Submits the Form

**As a** Player,
**I want to** fill in all required fields and submit the form,
**so that** my character is created and I am taken to my character sheet.

**Acceptance Criteria:**
- [ ] AC-001: Given all required fields are filled, when I click "Create Character", the character is created and I am redirected to the character sheet.
- [ ] AC-002: Given I submit with an ability score of 0, the API returns a 400 and the error is shown inline (not a redirect).
- [ ] AC-003: Given I click "Cancel", I am returned to the campaign dashboard with no character created.

---

## 5. Design

### 5.1 High-Level Design

The character creation page is a new route: `/campaigns/:id/characters/new`.

```mermaid
flowchart TD
    A[Campaign Dashboard] -->|Click 'New Character'| B[/campaigns/:id/characters/new]
    B --> C{Form Complete?}
    C -- Yes --> D[POST /api/v1/campaigns/:id/characters]
    D -- 201 Created --> E[/characters/:newId]
    D -- 4xx Error --> F[Show inline errors on form]
    F --> C
    B -->|Cancel| A
```

### 5.2 Data Model

No schema changes. The existing `characters` table and `POST /api/v1/campaigns/:id/characters` endpoint are unchanged.

### 5.3 Frontend Component Design

**Route:** `src/pages/CharacterCreationPage.tsx`

**Sections:**
1. **Identity** — Character name (text input)
2. **Class** — Searchable selector; on SRD selection, shows hit die + primary ability hint
3. **Race** — Searchable selector; on SRD selection, shows ability score bonuses
4. **Background** — Searchable selector (informational only)
5. **Level & XP** — Number inputs (level 1–20, XP ≥ 0)
6. **Ability Scores** — 6 number inputs (STR, DEX, CON, INT, WIS, CHA); range 1–30
7. **Combat Stats** — Max HP, AC, Speed
8. **Actions** — "Create Character" (submit) + "Cancel" (navigate back)

**SRD data loading:**
- On page mount, fetch `/api/v1/compendium/classes`, `/api/v1/compendium/races`, `/api/v1/compendium/backgrounds`
- Show skeleton/loading state in selectors while fetching
- Cache results for the session to avoid re-fetching on re-render

### 5.4 API / Interface Design

No new API endpoints. Uses existing:
- `GET /api/v1/compendium/classes` — populates class selector
- `GET /api/v1/compendium/races` — populates race selector
- `GET /api/v1/compendium/backgrounds` — populates background selector
- `POST /api/v1/campaigns/:id/characters` — creates the character

### 5.5 Error Handling

| Error Case | Behavior | HTTP Code |
|------------|----------|-----------|
| Required field missing | Inline field error before submit | — (client-side) |
| Ability score out of range | API returns 400; inline error shown | 400 |
| Level out of range | API returns 400; inline error shown | 400 |
| Network error on SRD load | Selector falls back to free-text input with warning | — |
| 401/403 on submit | Redirect to login | 401/403 |

---

## 6. Testing Strategy

### 6.1 Unit Tests

- [ ] Class selector — filters list on text input.
- [ ] Class selector — allows custom free-text value not in SRD list.
- [ ] Hint display — shows correct hit die when SRD class is selected.
- [ ] Form validation — rejects submission when required fields are empty.

### 6.2 Integration Tests

- [ ] End-to-end: select class/race/background from SRD, fill stats, submit → character created.
- [ ] API error (400) → inline error message displayed, no redirect.
- [ ] Cancel → navigate back to campaign dashboard.
- [ ] SRD selectors load correctly from compendium API.

### 6.3 Edge Cases

- [ ] SRD fetch fails → selectors degrade gracefully to free-text.
- [ ] Very long custom class/race name (100 chars) — truncated or rejected with message.
- [ ] User navigates away mid-form — no partial character created.

---

## 7. Security Considerations

- [ ] Character creation is campaign-scoped; server verifies campaign membership on `POST`.
- [ ] No server-side changes — all security constraints from SPEC-003 remain in place.
- [ ] Custom selector values are submitted as plain text and validated server-side for length.

---

## 8. Implementation Plan

| Task | Description | Depends On |
|------|-------------|------------|
| T-01 | Create `CharacterCreationPage.tsx` route component | — |
| T-02 | Add route `/campaigns/:id/characters/new` in `App.tsx` | T-01 |
| T-03 | Build `SrdSelector` component (searchable dropdown with custom value support) | — |
| T-04 | Integrate SRD data fetch (classes, races, backgrounds) into creation page | T-01, T-03 |
| T-05 | Build ability scores section + HP/AC/Speed inputs | T-01 |
| T-06 | Wire form submit to `POST /api/v1/campaigns/:id/characters`; handle inline errors | T-01, T-05 |
| T-07 | Update campaign dashboard to link "New Character" button to new route | T-02 |
| T-08 | Unit tests for `SrdSelector` component | T-03 |
| T-09 | Integration tests for creation flow | T-06 |

---

## 9. Open Questions

| # | Question | Owner | Status | Resolution |
|---|----------|-------|--------|------------|
| 1 | Should the creation page auto-populate skill proficiencies based on selected class/background? | Team | Open | — |
| 2 | Should we show a preview of the character sheet as the user fills in the form? | Team | Open | — |
| 3 | Should the form be split into multiple steps (wizard) or a single long form? | Team | Open | — |

---

## 10. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|-------------------------|
| 2026-03-12 | No schema changes — UI-only refactor | Data model from SPEC-003 is sufficient; selector values are hints only | Adding FK to `srd_classes` on `characters` table |
| 2026-03-12 | Custom free-text values always allowed | DMs and players use homebrew content; blocking non-SRD values would be too restrictive | SRD values only |

---

## 11. Changelog

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1 | 2026-03-12 | RoleCompanion Team | Initial draft — dedicated character creation page with SRD selectors |
