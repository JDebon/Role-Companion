# Implementation Plan — SPEC-001: Auth & Campaign Management

**Spec:** [SPEC-001-auth-campaign.md](./SPEC-001-auth-campaign.md)
**Status:** Pending
**Last Updated:** 2026-03-09

---


## Task Overview

```
T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07
                                    └───── → T-08
                       T-04 ──────────────── T-09
                       T-04 → T-10
                       T-06 → T-11
                       T-08 → T-12
```

---

## Tasks

### T-01 — Initialize monorepo
**Depends on:** —
**Status:** [ ] Pending

Set up the project skeleton with pnpm workspaces:

```
rolecompanion/
├── apps/
│   ├── web/          # React + TypeScript + Vite
│   └── api/          # Node.js + Hono
├── packages/
│   └── db/           # Drizzle ORM schema + migrations
├── pnpm-workspace.yaml
├── package.json
└── turbo.json        # (optional, for Turborepo)
```

- [ ] Init pnpm workspace root
- [ ] Scaffold `apps/api` with Hono + TypeScript
- [ ] Scaffold `apps/web` with Vite + React + TypeScript + Tailwind
- [ ] Scaffold `packages/db` with Drizzle ORM
- [ ] Set up shared tsconfig
- [ ] Add `.env.example` with required variables (`DATABASE_URL`, `JWT_SECRET`)

---

### T-02 — DB schema: users, campaigns, campaign_members
**Depends on:** T-01
**Status:** [ ] Pending

Define Drizzle ORM tables in `packages/db/schema.ts`:

- [ ] `users` table: `id` (UUID), `email` (unique), `password_hash`, `display_name`, `created_at`, `updated_at`
- [ ] `campaigns` table: `id` (UUID), `name` (varchar 100), `invite_code` (unique), `invite_expires_at` (nullable), `created_at`, `updated_at`
- [ ] `campaign_members` table: `id`, `campaign_id` (FK), `user_id` (FK), `role` (enum: `dungeon_master|player`), `joined_at`
- [ ] Add unique constraint on `(campaign_id, user_id)` in `campaign_members`

---

### T-03 — Initial DB migration
**Depends on:** T-02
**Status:** [ ] Pending

- [ ] Run `drizzle-kit generate` to produce the SQL migration
- [ ] Apply migration to local dev database
- [ ] Verify schema with `psql` or a DB GUI

---

### T-04 — Auth endpoints: register + login
**Depends on:** T-03
**Status:** [ ] Pending

Implement in `apps/api/src/routes/auth.ts`:

- [ ] `POST /api/v1/auth/register`
  - Validate email format and password ≥ 8 chars (Zod)
  - Check email uniqueness → 409 if taken
  - Hash password with bcrypt (cost 12)
  - Insert user
  - Return JWT
- [ ] `POST /api/v1/auth/login`
  - Validate inputs
  - Lookup user by email (return 401 if not found — same error as wrong password)
  - Compare password with bcrypt
  - Return JWT on success
- [ ] JWT helper: `signToken(userId)` and `verifyToken(token)` in `packages/db` or shared util

---

### T-05 — Auth middleware
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Create Hono middleware that reads `Authorization: Bearer <token>`
- [ ] Verify JWT and attach `{ userId, email, displayName }` to request context
- [ ] Return 401 if missing or invalid
- [ ] Apply middleware to all `/api/v1/campaigns/*` routes

---

### T-06 — Campaign CRUD endpoints
**Depends on:** T-05
**Status:** [ ] Pending

- [ ] `POST /api/v1/campaigns` — create campaign, auto-generate invite code, insert DM membership
- [ ] `GET /api/v1/campaigns` — list all campaigns for the authenticated user (with role)
- [ ] `GET /api/v1/campaigns/:id` — get single campaign (must be member)
- [ ] `GET /api/v1/campaigns/:id/members` — list members (must be member)
- [ ] `PATCH /api/v1/campaigns/:id` — rename campaign (DM only)
- [ ] `DELETE /api/v1/campaigns/:id` — delete campaign (DM only)

---

### T-07 — Join campaign + invite code regeneration
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] `POST /api/v1/campaigns/join` — lookup campaign by invite code, add user as `player` (409 if already member, 400 if code invalid/expired)
- [ ] `POST /api/v1/campaigns/:id/invite/regenerate` — DM only; generate new random code, invalidate old one

---

### T-08 — Remove member endpoint
**Depends on:** T-06
**Status:** [ ] Pending

- [ ] `DELETE /api/v1/campaigns/:id/members/:userId` — DM only
- [ ] Guard: DM cannot remove themselves
- [ ] Guard: target user must be a member of the campaign

---

### T-09 — Tests: auth + campaign
**Depends on:** T-04, T-05, T-06, T-07, T-08
**Status:** [ ] Pending

Unit tests:
- [ ] `hashPassword` / `verifyPassword` — bcrypt correctness
- [ ] `signToken` / `verifyToken` — payload correctness, expiry, tamper rejection
- [ ] `generateInviteCode` — 8-char alphanumeric, randomness

Integration tests (use a test database):
- [ ] Register → Login → valid JWT
- [ ] Duplicate email → 409
- [ ] Wrong password → 401
- [ ] Create campaign → invite code present
- [ ] Join campaign → player role assigned
- [ ] Join twice → 409
- [ ] Invalid invite code → 400
- [ ] DM removes player → 204; player can no longer access
- [ ] Non-DM remove attempt → 403
- [ ] DM remove self → error
- [ ] Regenerate invite → old code invalid

---

### T-10 — Frontend: Register / Login pages
**Depends on:** T-04
**Status:** [ ] Pending

- [ ] Register page: email, display name, password fields + submit
- [ ] Login page: email, password fields + submit
- [ ] Store JWT in httpOnly cookie (or in-memory, per open question Q-1)
- [ ] Redirect to campaign list on success
- [ ] Display validation and server errors inline

---

### T-11 — Frontend: Campaign list, create, join
**Depends on:** T-06, T-07
**Status:** [ ] Pending

- [ ] Campaign list page: show all campaigns with role badge
- [ ] Create campaign modal/form: name input
- [ ] Join campaign modal/form: invite code input
- [ ] Navigate to campaign dashboard on select

---

### T-12 — Frontend: Campaign settings
**Depends on:** T-08
**Status:** [ ] Pending

- [ ] Campaign settings page (DM only access)
- [ ] Member list with role badges
- [ ] Invite code display + "Regenerate" button
- [ ] Remove player button with confirmation dialog

---

## Open Questions to Resolve Before T-10

| # | Question | Impact |
|---|----------|--------|
| Q-1 | JWT storage: httpOnly cookie vs in-memory? | Affects T-10 implementation |
| Q-2 | Invite code expiry: default on or off? | Affects T-07 implementation |
| Q-3 | Can a user be DM in one campaign and Player in another? | Schema is already flexible; just confirm expected UX |
