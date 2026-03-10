# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Methodology

This project uses **Spec-Driven Development (SDD)**. Always write a spec first (in `specs/`), get approval, then implement. See `specs/SPEC_TEMPLATE.md` for the template and naming conventions (`SPEC-XXX-feature-name.md`).

## Commands

### Start dev stack (api:3001, web:5173, db:5432)
```bash
docker compose up
```

### Run all tests (isolated Docker environment)
```bash
docker compose -f docker-compose.test.yml run --rm api-test
# or
pnpm test
```

> Before running tests after adding a new migration, tear down first:
> ```bash
> docker compose -f docker-compose.test.yml down -v
> ```

### Run a single test file (requires the test DB to be running)
```bash
pnpm --filter api test -- src/tests/auth.test.ts
```

### DB operations
```bash
pnpm --filter @rolecompanion/db migrate        # run migrations
pnpm --filter @rolecompanion/db seed           # seed SRD data from local fixtures
pnpm --filter @rolecompanion/db seed:download  # re-download SRD fixtures from GitHub (then commit)
pnpm --filter @rolecompanion/db studio         # open Drizzle Studio
```

## Architecture

### Monorepo layout
- `apps/api` — Hono + TypeScript API (internal port 3000, exposed as 3001)
- `apps/web` — Vite + React 19 + Tailwind v4 frontend
- `packages/db` — Drizzle ORM schema, migrations, and seed scripts

### API (`apps/api`)
- Entry point: `src/index.ts` (starts server); `src/app.ts` (Hono app exported for tests)
- All routes registered in `src/app.ts` under `/api/v1/`
- Route modules export named routers; each file owns one feature domain
- Auth flow: `Authorization: Bearer <jwt>` → `authMiddleware` → sets `c.var.user` (JwtPayload with `sub`, `email`, `displayName`)
- Campaign membership checked inline in route handlers; `dungeon_master` role required for write operations on DM-only resources
- Error responses via `src/lib/errors.ts` `errorResponse()` helper
- Zod validators via `@hono/zod-validator` on all mutation endpoints

### Database (`packages/db`)
- Schema defined in `src/schema.ts` — single source of truth
- Migrations are hand-authored SQL files in `migrations/` with a journal entry in `migrations/meta/_journal.json`
- **Migration hash tracking:** Drizzle tracks applied migrations by SHA256 of the SQL file in `drizzle.__drizzle_migrations`. `drizzle-kit migrate` silently skips manually created migrations that lack a snapshot in `migrations/meta/` — so after adding a new migration, always apply it to the dev DB manually:
  ```bash
  # 1. Run the SQL
  docker compose exec db psql -U rolecompanion -d rolecompanion -f packages/db/migrations/000X_name.sql

  # 2. Register the hash
  hash=$(sha256sum packages/db/migrations/000X_name.sql | awk '{print $1}')
  docker compose exec db psql -U rolecompanion -d rolecompanion \
    -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$hash', $(date +%s%3N));"
  ```
  Alternatively, `docker compose down -v && docker compose up` wipes the DB and reapplies all migrations from scratch.
- SRD data lives in `fixtures/*.json` (committed). The seed is idempotent and runs on every `docker compose up` via `entrypoint.sh`

### Frontend (`apps/web`)
- All routes in `src/App.tsx`; `ProtectedRoute` wraps authenticated pages
- API calls in `src/api/client.ts`
- Routes follow the pattern `/campaigns/:id/<feature>` for campaign-scoped pages

### Test patterns
- Tests use Hono's `app.request()` directly (no HTTP server needed)
- Each test file calls `clearDb()` from `src/tests/setup.ts` in `beforeEach`
- Tests are colocated in `src/tests/*.test.ts`
- The test DB is seeded with SRD data before tests run (available for compendium queries)
