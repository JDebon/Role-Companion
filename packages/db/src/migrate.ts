import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
const db = drizzle(sql)

await migrate(db, { migrationsFolder: join(__dirname, '..', 'migrations') })

console.log('Migrations complete.')
await sql.end()
