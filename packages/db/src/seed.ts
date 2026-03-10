import { sql } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from './client.js'
import {
  srdSpells,
  srdMonsters,
  srdEquipment,
  srdMagicItems,
  srdClasses,
  srdRaces,
  srdBackgrounds,
  srdConditions,
  srdSkills,
  srdDamageTypes,
  srdMagicSchools,
  srdWeaponProperties,
} from './schema.js'
import {
  base,
  transformSpell,
  transformMonster,
  transformEquipment,
  transformMagicItem,
  type RawEntry,
} from './srd-transforms.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures')

function loadFixture(file: string): RawEntry[] {
  const path = join(FIXTURES_DIR, `${file}.json`)
  return JSON.parse(readFileSync(path, 'utf-8')) as RawEntry[]
}

async function seed() {
  console.log('Starting SRD seed...')

  // Spells
  {
    const entries = loadFixture('5e-SRD-Spells')
    const rows = entries.map(transformSpell)
    await db
      .insert(srdSpells)
      .values(rows)
      .onConflictDoUpdate({
        target: srdSpells.index,
        set: {
          name: sql`EXCLUDED.name`,
          level: sql`EXCLUDED.level`,
          school: sql`EXCLUDED.school`,
          concentration: sql`EXCLUDED.concentration`,
          ritual: sql`EXCLUDED.ritual`,
          classes: sql`EXCLUDED.classes`,
          data: sql`EXCLUDED.data`,
        },
      })
    console.log(`Seeded ${rows.length} spells`)
  }

  // Monsters
  {
    const entries = loadFixture('5e-SRD-Monsters')
    const rows = entries.map(transformMonster)
    await db
      .insert(srdMonsters)
      .values(rows)
      .onConflictDoUpdate({
        target: srdMonsters.index,
        set: {
          name: sql`EXCLUDED.name`,
          challengeRating: sql`EXCLUDED.challenge_rating`,
          monsterType: sql`EXCLUDED.monster_type`,
          size: sql`EXCLUDED.size`,
          data: sql`EXCLUDED.data`,
        },
      })
    console.log(`Seeded ${rows.length} monsters`)
  }

  // Equipment
  {
    const entries = loadFixture('5e-SRD-Equipment')
    const rows = entries.map(transformEquipment)
    await db
      .insert(srdEquipment)
      .values(rows)
      .onConflictDoUpdate({
        target: srdEquipment.index,
        set: {
          name: sql`EXCLUDED.name`,
          equipmentCategory: sql`EXCLUDED.equipment_category`,
          weaponCategory: sql`EXCLUDED.weapon_category`,
          data: sql`EXCLUDED.data`,
        },
      })
    console.log(`Seeded ${rows.length} equipment`)
  }

  // Magic Items
  {
    const entries = loadFixture('5e-SRD-Magic-Items')
    const rows = entries.map(transformMagicItem)
    await db
      .insert(srdMagicItems)
      .values(rows)
      .onConflictDoUpdate({
        target: srdMagicItems.index,
        set: {
          name: sql`EXCLUDED.name`,
          rarity: sql`EXCLUDED.rarity`,
          data: sql`EXCLUDED.data`,
        },
      })
    console.log(`Seeded ${rows.length} magic items`)
  }

  // Generic collections
  const generics = [
    { file: '5e-SRD-Classes', table: srdClasses, label: 'classes' },
    { file: '5e-SRD-Races', table: srdRaces, label: 'races' },
    { file: '5e-SRD-Backgrounds', table: srdBackgrounds, label: 'backgrounds' },
    { file: '5e-SRD-Conditions', table: srdConditions, label: 'conditions' },
    { file: '5e-SRD-Skills', table: srdSkills, label: 'skills' },
    { file: '5e-SRD-Damage-Types', table: srdDamageTypes, label: 'damage types' },
    { file: '5e-SRD-Magic-Schools', table: srdMagicSchools, label: 'magic schools' },
    {
      file: '5e-SRD-Weapon-Properties',
      table: srdWeaponProperties,
      label: 'weapon properties',
    },
  ] as const

  for (const { file, table, label } of generics) {
    const entries = loadFixture(file)
    const rows = entries.map(base)
    await db
      .insert(table)
      .values(rows)
      .onConflictDoUpdate({
        target: table.index,
        set: {
          name: sql`EXCLUDED.name`,
          data: sql`EXCLUDED.data`,
        },
      })
    console.log(`Seeded ${rows.length} ${label}`)
  }

  console.log('SRD seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
