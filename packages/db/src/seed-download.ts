/**
 * Downloads SRD JSON fixtures from 5e-bits/5e-database (2014 edition).
 * Run this once (or whenever you want to update SRD data) and commit the result.
 *
 * Usage: pnpm --filter @rolecompanion/db seed:download
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '..', 'fixtures')
const BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014'

const FILES = [
  '5e-SRD-Spells',
  '5e-SRD-Monsters',
  '5e-SRD-Equipment',
  '5e-SRD-Magic-Items',
  '5e-SRD-Classes',
  '5e-SRD-Races',
  '5e-SRD-Backgrounds',
  '5e-SRD-Conditions',
  '5e-SRD-Skills',
  '5e-SRD-Damage-Types',
  '5e-SRD-Magic-Schools',
  '5e-SRD-Weapon-Properties',
]

mkdirSync(FIXTURES_DIR, { recursive: true })

for (const file of FILES) {
  const url = `${BASE}/${file}.json`
  console.log(`Downloading ${file}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const data = await res.json()
  const outPath = join(FIXTURES_DIR, `${file}.json`)
  writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(`  → ${(data as unknown[]).length} entries saved to fixtures/${file}.json`)
}

console.log('All fixtures downloaded.')
