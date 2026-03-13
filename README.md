# RoleCompanion

A full-stack D&D 5e campaign companion app. Manage campaigns, characters, spells, inventory, encounters, NPCs, session logs, and custom content — all in one place.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind v4
- **Backend:** Hono + TypeScript (Node 25)
- **Database:** PostgreSQL 17 + Drizzle ORM
- **Monorepo:** pnpm workspaces
- **Runtime:** Docker + Docker Compose

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- [pnpm](https://pnpm.io/installation) (only needed if running outside Docker or running tests)
- Node.js 20+ (only needed outside Docker)

## Local Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd RoleCompanion
```

### 2. Start the dev stack

```bash
docker compose up
```

This single command will:
1. Start PostgreSQL 17 on port `5432`
2. Run all pending database migrations automatically
3. Seed the SRD data (spells, monsters, equipment, classes, races, etc.) from local fixtures — no internet required
4. Start the API server on port `3001`
5. Start the frontend dev server on port `5173`

All source files are volume-mounted, so edits to `apps/api/src/`, `apps/web/src/`, and `packages/db/src/` are reflected immediately without rebuilding.

### 3. Open the app

| Service  | URL                      |
|----------|--------------------------|
| Frontend | http://localhost:5173    |
| API      | http://localhost:3001    |
| DB       | localhost:5432           |

DB credentials (dev only):
- **User:** `rolecompanion`
- **Password:** `secret`
- **Database:** `rolecompanion`

### 4. Register an account

Navigate to http://localhost:5173/register to create your first account. The first user to create a campaign becomes the Dungeon Master for it.

---

## Running Tests

Tests run in an isolated Docker environment with their own database:

```bash
docker compose -f docker-compose.test.yml run --rm api-test
# or
pnpm test
```

> **Important:** If you added a new database migration since the last test run, tear down the test DB volume first:
> ```bash
> docker compose -f docker-compose.test.yml down -v
> ```
> Then re-run the tests. This ensures the fresh schema is applied cleanly.

To run a single test file (requires the test DB to already be running):

```bash
pnpm --filter api test -- src/tests/auth.test.ts
```

---

## Database Operations

```bash
# Apply pending migrations
pnpm --filter @rolecompanion/db migrate

# Seed SRD data from local fixtures (idempotent)
pnpm --filter @rolecompanion/db seed

# Re-download SRD fixtures from GitHub (then commit the result)
pnpm --filter @rolecompanion/db seed:download

# Open Drizzle Studio (GUI for the database)
pnpm --filter @rolecompanion/db studio
```

> Migrations and seeding run automatically on every `docker compose up`, so manual invocation is rarely needed.

### Adding a migration

1. Create a new SQL file in `packages/db/migrations/` (e.g., `0009_my_feature.sql`)
2. Add a corresponding entry to `packages/db/migrations/meta/_journal.json`
3. The next `docker compose up` (or `pnpm --filter @rolecompanion/db migrate`) will detect and apply it automatically via SHA256 hash tracking

---

## Project Structure

```
RoleCompanion/
├── apps/
│   ├── api/          # Hono API (port 3001 externally, 3000 internally)
│   │   └── src/
│   │       ├── app.ts          # Hono app + route registration
│   │       ├── index.ts        # Server entrypoint
│   │       ├── routes/         # Feature route modules
│   │       ├── lib/            # Auth middleware, JWT, errors, etc.
│   │       └── tests/          # Vitest test files
│   └── web/          # Vite + React frontend (port 5173)
│       └── src/
│           ├── App.tsx         # Route definitions
│           ├── api/client.ts   # API client
│           ├── pages/          # Page components
│           └── components/     # Shared UI components
├── packages/
│   └── db/           # Drizzle schema, migrations, seed scripts
│       ├── src/
│       │   ├── schema.ts       # Single source of truth for DB schema
│       │   ├── migrate.ts      # Custom migration runner
│       │   └── seed.ts         # SRD seed script
│       ├── migrations/         # Hand-authored SQL migration files
│       └── fixtures/           # Committed SRD JSON fixtures
├── specs/            # Spec-Driven Development specs
├── docker-compose.yml
└── docker-compose.test.yml
```

---

## Features

| Feature | Route |
|---------|-------|
| Campaign list & management | `/campaigns` |
| Campaign overview (members, invite) | `/campaigns/:id` |
| Character sheet (stats, HP, conditions) | `/campaigns/:id/characters/:charId` |
| Spell management & slot tracker | Character sheet → Spells tab |
| Inventory & currency tracker | Character sheet → Inventory tab |
| Character notes | Character sheet → Notes tab |
| Encounter runner (initiative, HP) | `/campaigns/:id/encounters` |
| NPC manager | `/campaigns/:id/npcs` |
| Session logs | `/campaigns/:id/session-logs` |
| DM notes | `/campaigns/:id/dm-notes` |
| Custom content (clone/create SRD entities) | `/campaigns/:id/custom-content` |
| SRD compendium (spells, monsters, items) | API: `/api/v1/compendium/*` |

---

## API Overview

All endpoints are under `/api/v1/`. Authentication uses a Bearer JWT token (7-day expiry) returned at login.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/campaigns
POST   /api/v1/campaigns
POST   /api/v1/campaigns/join
GET    /api/v1/campaigns/:id/members

GET    /api/v1/campaigns/:id/characters
POST   /api/v1/campaigns/:id/characters
GET    /api/v1/characters/:id
PATCH  /api/v1/characters/:id

GET    /api/v1/characters/:id/inventory
POST   /api/v1/characters/:id/inventory
PATCH  /api/v1/characters/:id/inventory/:itemId
DELETE /api/v1/characters/:id/inventory/:itemId
PUT    /api/v1/characters/:id/currency

GET    /api/v1/characters/:id/spells
POST   /api/v1/characters/:id/spells
PUT    /api/v1/characters/:id/spell-slots

GET    /api/v1/campaigns/:id/encounters
POST   /api/v1/campaigns/:id/encounters
POST   /api/v1/campaigns/:id/encounters/:encId/start
POST   /api/v1/campaigns/:id/encounters/:encId/next-turn

GET    /api/v1/campaigns/:id/npcs
POST   /api/v1/campaigns/:id/npcs

GET    /api/v1/compendium/spells
GET    /api/v1/compendium/monsters
GET    /api/v1/compendium/equipment
```

---

## Development Notes

- This project follows **Spec-Driven Development (SDD)**. All feature specs live in `specs/` and are written before implementation begins.
- The SRD data (D&D 5e 2014 Systems Reference Document) is seeded from local fixture files in `packages/db/fixtures/` — no external API calls at runtime.
- Custom content supports cloning SRD entities (with overrides stored as JSONB) or creating from scratch.
