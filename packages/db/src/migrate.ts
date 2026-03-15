import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'migrations')

const connectionString = process.env.DATABASE_URL!
const sql = postgres(connectionString, { onnotice: () => {} })

const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')
) as { entries: Array<{ tag: string }> }

// Ensure tracking table exists
await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`

const applied = await sql<{ hash: string }[]>`
  SELECT hash FROM drizzle.__drizzle_migrations
`
const appliedHashes = new Set(applied.map((r) => r.hash))

for (const entry of journal.entries) {
  const filePath = join(migrationsDir, `${entry.tag}.sql`)
  const sqlContent = readFileSync(filePath, 'utf8')
  const hash = createHash('sha256').update(sqlContent).digest('hex')

  if (appliedHashes.has(hash)) {
    console.log(`  ✓ ${entry.tag}`)
    continue
  }

  console.log(`  → applying ${entry.tag}`)

  // Split on the drizzle breakpoint marker and run each statement
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)

  await sql.begin(async (tx) => {
    for (const stmt of statements) {
      await tx.unsafe(stmt)
    }

    await tx`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `
  })
}

console.log('Migrations complete.')
await sql.end()
