import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import {
  db,
  characters,
  campaignMembers,
  srdSpells,
  characterSpells,
  spellSlots,
  concentrationTracker,
} from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { errorResponse } from '../lib/errors.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMembership(campaignId: string, userId: string) {
  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
    .limit(1)
  return member ?? null
}

async function getCharacterWithMemberCheck(characterId: string, requesterId: string) {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1)
  if (!char) return { char: null, member: null }
  const member = await getMembership(char.campaignId, requesterId)
  if (!member) return { char: null, member: null }
  return { char, member }
}

// ── Pure utils (exported for unit tests) ─────────────────────────────────────

export function formatSlots(row: {
  l1Total: number; l1Used: number
  l2Total: number; l2Used: number
  l3Total: number; l3Used: number
  l4Total: number; l4Used: number
  l5Total: number; l5Used: number
  l6Total: number; l6Used: number
  l7Total: number; l7Used: number
  l8Total: number; l8Used: number
  l9Total: number; l9Used: number
}) {
  return {
    l1: { total: row.l1Total, used: row.l1Used },
    l2: { total: row.l2Total, used: row.l2Used },
    l3: { total: row.l3Total, used: row.l3Used },
    l4: { total: row.l4Total, used: row.l4Used },
    l5: { total: row.l5Total, used: row.l5Used },
    l6: { total: row.l6Total, used: row.l6Used },
    l7: { total: row.l7Total, used: row.l7Used },
    l8: { total: row.l8Total, used: row.l8Used },
    l9: { total: row.l9Total, used: row.l9Used },
  }
}

export function canExpendSlot(total: number, used: number): boolean {
  return used < total
}

export function applyLongRest(slots: ReturnType<typeof formatSlots>) {
  const result = { ...slots }
  for (const key of Object.keys(result) as Array<keyof typeof result>) {
    result[key] = { ...result[key], used: 0 }
  }
  return result
}

const EMPTY_SLOTS = {
  l1Total: 0, l1Used: 0,
  l2Total: 0, l2Used: 0,
  l3Total: 0, l3Used: 0,
  l4Total: 0, l4Used: 0,
  l5Total: 0, l5Used: 0,
  l6Total: 0, l6Used: 0,
  l7Total: 0, l7Used: 0,
  l8Total: 0, l8Used: 0,
  l9Total: 0, l9Used: 0,
}

async function getOrDefaultSlots(characterId: string) {
  const [row] = await db
    .select()
    .from(spellSlots)
    .where(eq(spellSlots.characterId, characterId))
    .limit(1)
  return row ?? { characterId, ...EMPTY_SLOTS, updatedAt: new Date(), id: '' }
}

async function buildSpellsResponse(characterId: string) {
  // Character spells with SRD join
  const spellRows = await db
    .select({
      spellIndex: characterSpells.spellIndex,
      status: characterSpells.status,
      addedAt: characterSpells.addedAt,
      srdName: srdSpells.name,
      srdLevel: srdSpells.level,
      srdSchool: srdSpells.school,
      srdConcentration: srdSpells.concentration,
    })
    .from(characterSpells)
    .leftJoin(srdSpells, eq(characterSpells.spellIndex, srdSpells.index))
    .where(eq(characterSpells.characterId, characterId))

  const spells = spellRows.map((r) => ({
    spellIndex: r.spellIndex,
    name: r.srdName ?? r.spellIndex,
    level: r.srdLevel ?? 0,
    school: r.srdSchool ?? '',
    concentration: r.srdConcentration ?? false,
    status: r.status,
  }))

  // Slots
  const slotsRow = await getOrDefaultSlots(characterId)
  const slots = formatSlots(slotsRow)

  // Concentration
  const [concRow] = await db
    .select()
    .from(concentrationTracker)
    .where(eq(concentrationTracker.characterId, characterId))
    .limit(1)

  let concentration: { spellIndex: string; name: string; startedAt: Date } | null = null
  if (concRow?.spellIndex) {
    const [spell] = await db
      .select({ name: srdSpells.name })
      .from(srdSpells)
      .where(eq(srdSpells.index, concRow.spellIndex))
      .limit(1)
    concentration = {
      spellIndex: concRow.spellIndex,
      name: spell?.name ?? concRow.spellIndex,
      startedAt: concRow.startedAt!,
    }
  }

  return { slots, concentration, spells }
}

// ── Validation schemas ────────────────────────────────────────────────────────

const addSpellSchema = z.object({
  spellIndex: z.string().min(1),
  status: z.enum(['known', 'prepared']),
})

const slotsSchema = z.object({
  l1Total: z.number().int().min(0).optional(),
  l2Total: z.number().int().min(0).optional(),
  l3Total: z.number().int().min(0).optional(),
  l4Total: z.number().int().min(0).optional(),
  l5Total: z.number().int().min(0).optional(),
  l6Total: z.number().int().min(0).optional(),
  l7Total: z.number().int().min(0).optional(),
  l8Total: z.number().int().min(0).optional(),
  l9Total: z.number().int().min(0).optional(),
})

const expendSchema = z.object({
  level: z.number().int().min(1).max(9),
})

const recoverSchema = z.object({
  type: z.enum(['long']),
})

const concentrationSchema = z.object({
  spellIndex: z.string().min(1).nullable(),
})

// ── Router ────────────────────────────────────────────────────────────────────

export const spellsRouter = new Hono<{ Variables: Variables }>()
spellsRouter.use('*', authMiddleware)

// GET /characters/:id/spells
spellsRouter.get('/:id/spells', async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  return c.json(await buildSpellsResponse(characterId))
})

// POST /characters/:id/spells
spellsRouter.post('/:id/spells', zValidator('json', addSpellSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const { spellIndex, status } = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  // Validate spell exists in SRD
  const [srdSpell] = await db
    .select()
    .from(srdSpells)
    .where(eq(srdSpells.index, spellIndex))
    .limit(1)
  if (!srdSpell) return errorResponse(c, 404, 'SPELL_NOT_FOUND')

  // Check duplicate
  const [existing] = await db
    .select({ id: characterSpells.id })
    .from(characterSpells)
    .where(and(eq(characterSpells.characterId, characterId), eq(characterSpells.spellIndex, spellIndex)))
    .limit(1)
  if (existing) return errorResponse(c, 409, 'ALREADY_KNOWN')

  await db.insert(characterSpells).values({ characterId, spellIndex, status })

  return c.json({
    spellIndex: srdSpell.index,
    name: srdSpell.name,
    level: srdSpell.level,
    school: srdSpell.school,
    concentration: srdSpell.concentration,
    status,
  }, 201)
})

// DELETE /characters/:id/spells/:spellIndex
spellsRouter.delete('/:id/spells/:spellIndex', async (c) => {
  const characterId = c.req.param('id')
  const spellIndex = c.req.param('spellIndex')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [existing] = await db
    .select({ id: characterSpells.id })
    .from(characterSpells)
    .where(and(eq(characterSpells.characterId, characterId), eq(characterSpells.spellIndex, spellIndex)))
    .limit(1)
  if (!existing) return errorResponse(c, 404, 'NOT_FOUND')

  await db
    .delete(characterSpells)
    .where(and(eq(characterSpells.characterId, characterId), eq(characterSpells.spellIndex, spellIndex)))

  // Also clear concentration if this was the active spell
  await db
    .update(concentrationTracker)
    .set({ spellIndex: null, startedAt: null, updatedAt: new Date() })
    .where(and(eq(concentrationTracker.characterId, characterId), eq(concentrationTracker.spellIndex, spellIndex)))

  return c.body(null, 204)
})

// PUT /characters/:id/spell-slots
spellsRouter.put('/:id/spell-slots', zValidator('json', slotsSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const data = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const existing = await getOrDefaultSlots(characterId)

  // Build update values — only change totals provided; clamp used if needed
  const newTotals = {
    l1Total: data.l1Total ?? existing.l1Total,
    l2Total: data.l2Total ?? existing.l2Total,
    l3Total: data.l3Total ?? existing.l3Total,
    l4Total: data.l4Total ?? existing.l4Total,
    l5Total: data.l5Total ?? existing.l5Total,
    l6Total: data.l6Total ?? existing.l6Total,
    l7Total: data.l7Total ?? existing.l7Total,
    l8Total: data.l8Total ?? existing.l8Total,
    l9Total: data.l9Total ?? existing.l9Total,
  }

  const upsertValues = {
    characterId,
    ...newTotals,
    // Clamp used values so they never exceed new totals
    l1Used: Math.min(existing.l1Used, newTotals.l1Total),
    l2Used: Math.min(existing.l2Used, newTotals.l2Total),
    l3Used: Math.min(existing.l3Used, newTotals.l3Total),
    l4Used: Math.min(existing.l4Used, newTotals.l4Total),
    l5Used: Math.min(existing.l5Used, newTotals.l5Total),
    l6Used: Math.min(existing.l6Used, newTotals.l6Total),
    l7Used: Math.min(existing.l7Used, newTotals.l7Total),
    l8Used: Math.min(existing.l8Used, newTotals.l8Total),
    l9Used: Math.min(existing.l9Used, newTotals.l9Total),
    updatedAt: new Date(),
  }

  const [result] = await db
    .insert(spellSlots)
    .values(upsertValues)
    .onConflictDoUpdate({ target: spellSlots.characterId, set: upsertValues })
    .returning()

  return c.json(formatSlots(result))
})

// POST /characters/:id/spell-slots/expend
spellsRouter.post('/:id/spell-slots/expend', zValidator('json', expendSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const { level } = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const slotsRow = await getOrDefaultSlots(characterId)
  const key = `l${level}` as 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7' | 'l8' | 'l9'
  const totalKey = `l${level}Total` as keyof typeof slotsRow
  const usedKey = `l${level}Used` as keyof typeof slotsRow

  const total = slotsRow[totalKey] as number
  const used = slotsRow[usedKey] as number

  if (!canExpendSlot(total, used)) {
    return errorResponse(c, 400, 'INSUFFICIENT_SLOTS')
  }

  const updateSet = { [`l${level}Used`]: used + 1, updatedAt: new Date() }

  const [result] = await db
    .insert(spellSlots)
    .values({ characterId, ...EMPTY_SLOTS, [`l${level}Used`]: 1, updatedAt: new Date() })
    .onConflictDoUpdate({ target: spellSlots.characterId, set: updateSet })
    .returning()

  const slots = formatSlots(result)
  return c.json({ [key]: slots[key] })
})

// POST /characters/:id/spell-slots/recover
spellsRouter.post('/:id/spell-slots/recover', zValidator('json', recoverSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const existing = await getOrDefaultSlots(characterId)

  const resetUsed = {
    l1Used: 0, l2Used: 0, l3Used: 0, l4Used: 0, l5Used: 0,
    l6Used: 0, l7Used: 0, l8Used: 0, l9Used: 0,
    updatedAt: new Date(),
  }

  const [result] = await db
    .insert(spellSlots)
    .values({ characterId, ...EMPTY_SLOTS, l1Total: existing.l1Total, l2Total: existing.l2Total, l3Total: existing.l3Total, l4Total: existing.l4Total, l5Total: existing.l5Total, l6Total: existing.l6Total, l7Total: existing.l7Total, l8Total: existing.l8Total, l9Total: existing.l9Total, ...resetUsed })
    .onConflictDoUpdate({ target: spellSlots.characterId, set: resetUsed })
    .returning()

  return c.json(formatSlots(result))
})

// PUT /characters/:id/concentration
spellsRouter.put('/:id/concentration', zValidator('json', concentrationSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const { spellIndex } = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  if (spellIndex !== null) {
    // Validate the spell is on the character's spell list
    const [charSpell] = await db
      .select({ spellIndex: characterSpells.spellIndex })
      .from(characterSpells)
      .where(and(eq(characterSpells.characterId, characterId), eq(characterSpells.spellIndex, spellIndex)))
      .limit(1)
    if (!charSpell) return errorResponse(c, 404, 'SPELL_NOT_FOUND')

    // Validate the spell is a concentration spell
    const [srdSpell] = await db
      .select({ concentration: srdSpells.concentration, name: srdSpells.name })
      .from(srdSpells)
      .where(eq(srdSpells.index, spellIndex))
      .limit(1)
    if (!srdSpell || !srdSpell.concentration) {
      return errorResponse(c, 400, 'NOT_CONCENTRATION_SPELL')
    }

    const now = new Date()
    const upsertValues = { characterId, spellIndex, startedAt: now, updatedAt: now }
    await db
      .insert(concentrationTracker)
      .values(upsertValues)
      .onConflictDoUpdate({ target: concentrationTracker.characterId, set: { spellIndex, startedAt: now, updatedAt: now } })

    return c.json({ spellIndex, name: srdSpell.name, startedAt: now })
  } else {
    // End concentration
    const now = new Date()
    await db
      .insert(concentrationTracker)
      .values({ characterId, spellIndex: null, startedAt: null, updatedAt: now })
      .onConflictDoUpdate({ target: concentrationTracker.characterId, set: { spellIndex: null, startedAt: null, updatedAt: now } })

    return c.json({ spellIndex: null, name: null, startedAt: null })
  }
})
