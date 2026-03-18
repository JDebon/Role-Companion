import { Hono } from 'hono'
import { ilike, eq, and, sql } from 'drizzle-orm'
import { db } from '@rolecompanion/db'
import {
  srdSpells,
  srdMonsters,
  srdEquipment,
  srdClasses,
  srdRaces,
  srdBackgrounds,
  srdConditions,
  srdSkills,
} from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { errorResponse } from '../lib/errors.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

const router = new Hono<{ Variables: Variables }>()

router.use('*', authMiddleware)

// ── Pagination helper ─────────────────────────────────────────────────────────

function parsePagination(pageStr: string | undefined, limitStr: string | undefined) {
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

// ── GET /compendium/spells ────────────────────────────────────────────────────

router.get('/spells', async (c) => {
  const { q, level, school, class: cls, page: pageStr, limit: limitStr } = c.req.query()
  const { page, limit, offset } = parsePagination(pageStr, limitStr)

  const conditions = []
  if (q) conditions.push(ilike(srdSpells.name, `%${q}%`))
  if (level !== undefined) conditions.push(eq(srdSpells.level, parseInt(level, 10)))
  if (school) conditions.push(ilike(srdSpells.school, school))
  if (cls) conditions.push(sql`${srdSpells.classes} @> ARRAY[${cls}]::text[]`)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        index: srdSpells.index,
        name: srdSpells.name,
        level: srdSpells.level,
        school: srdSpells.school,
        concentration: srdSpells.concentration,
        ritual: srdSpells.ritual,
        classes: srdSpells.classes,
      })
      .from(srdSpells)
      .where(where)
      .orderBy(srdSpells.level, srdSpells.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(srdSpells)
      .where(where),
  ])

  return c.json({ data: rows, total: count, page, limit })
})

// ── GET /compendium/spells/:index ─────────────────────────────────────────────

router.get('/spells/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ data: srdSpells.data })
    .from(srdSpells)
    .where(eq(srdSpells.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row.data)
})

// ── GET /compendium/monsters ──────────────────────────────────────────────────

router.get('/monsters', async (c) => {
  const { q, cr, type, page: pageStr, limit: limitStr } = c.req.query()
  const { page, limit, offset } = parsePagination(pageStr, limitStr)

  const conditions = []
  if (q) conditions.push(ilike(srdMonsters.name, `%${q}%`))
  if (cr !== undefined) conditions.push(eq(srdMonsters.challengeRating, cr))
  if (type) conditions.push(ilike(srdMonsters.monsterType, type))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        index: srdMonsters.index,
        name: srdMonsters.name,
        challengeRating: srdMonsters.challengeRating,
        monsterType: srdMonsters.monsterType,
        size: srdMonsters.size,
        hitPoints: sql<number>`(${srdMonsters.data}->>'hit_points')::int`,
        armorClass: sql<number>`(${srdMonsters.data}->'armor_class'->0->>'value')::int`,
      })
      .from(srdMonsters)
      .where(where)
      .orderBy(srdMonsters.challengeRating, srdMonsters.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(srdMonsters)
      .where(where),
  ])

  return c.json({ data: rows, total: count, page, limit })
})

// ── GET /compendium/monsters/:index ──────────────────────────────────────────

router.get('/monsters/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ data: srdMonsters.data })
    .from(srdMonsters)
    .where(eq(srdMonsters.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row.data)
})

// ── GET /compendium/equipment ─────────────────────────────────────────────────

router.get('/equipment', async (c) => {
  const { q, category, page: pageStr, limit: limitStr } = c.req.query()
  const { page, limit, offset } = parsePagination(pageStr, limitStr)

  const conditions = []
  if (q) conditions.push(ilike(srdEquipment.name, `%${q}%`))
  if (category) conditions.push(ilike(srdEquipment.equipmentCategory, category))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        index: srdEquipment.index,
        name: srdEquipment.name,
        equipmentCategory: srdEquipment.equipmentCategory,
        weaponCategory: srdEquipment.weaponCategory,
      })
      .from(srdEquipment)
      .where(where)
      .orderBy(srdEquipment.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(srdEquipment)
      .where(where),
  ])

  return c.json({ data: rows, total: count, page, limit })
})

// ── GET /compendium/equipment/:index ─────────────────────────────────────────

router.get('/equipment/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ data: srdEquipment.data })
    .from(srdEquipment)
    .where(eq(srdEquipment.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row.data)
})

// ── GET /compendium/classes/:index ────────────────────────────────────────────

router.get('/classes/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ index: srdClasses.index, name: srdClasses.name, data: srdClasses.data })
    .from(srdClasses)
    .where(eq(srdClasses.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row)
})

// ── GET /compendium/races/:index ──────────────────────────────────────────────

router.get('/races/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ index: srdRaces.index, name: srdRaces.name, data: srdRaces.data })
    .from(srdRaces)
    .where(eq(srdRaces.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row)
})

// ── GET /compendium/backgrounds/:index ────────────────────────────────────────

router.get('/backgrounds/:index', async (c) => {
  const index = c.req.param('index')
  const [row] = await db
    .select({ index: srdBackgrounds.index, name: srdBackgrounds.name, data: srdBackgrounds.data })
    .from(srdBackgrounds)
    .where(eq(srdBackgrounds.index, index))
    .limit(1)
  if (!row) return errorResponse(c, 404, 'NOT_FOUND')
  return c.json(row)
})

// ── GET /compendium/:collection ───────────────────────────────────────────────

const genericCollections = {
  classes: srdClasses,
  races: srdRaces,
  backgrounds: srdBackgrounds,
  conditions: srdConditions,
  skills: srdSkills,
} as const

type GenericCollection = keyof typeof genericCollections

router.get('/:collection', async (c) => {
  const collection = c.req.param('collection') as GenericCollection
  const table = genericCollections[collection]
  if (!table) return errorResponse(c, 404, 'NOT_FOUND')

  const { q, page: pageStr, limit: limitStr } = c.req.query()
  const { page, limit, offset } = parsePagination(pageStr, limitStr)

  const where = q ? ilike(table.name, `%${q}%`) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ index: table.index, name: table.name })
      .from(table)
      .where(where)
      .orderBy(table.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(where),
  ])

  return c.json({ data: rows, total: count, page, limit })
})

export { router as compendiumRouter }
