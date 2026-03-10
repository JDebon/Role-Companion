import { db } from '@rolecompanion/db'
import { sql } from 'drizzle-orm'

export async function clearDb() {
  await db.execute(
    sql`TRUNCATE concentration_tracker, spell_slots, character_spells, inventory_items, character_currency, characters, campaign_members, campaigns, users RESTART IDENTITY CASCADE`
  )
}
