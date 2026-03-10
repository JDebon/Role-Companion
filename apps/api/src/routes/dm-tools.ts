import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, count, inArray } from 'drizzle-orm'
import {
  db,
  campaignMembers,
  characters,
  srdMonsters,
  customEntities,
  npcs,
  encounters,
  combatants,
} from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { errorResponse } from '../lib/errors.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

// ── Pure utilities (exported for unit tests) ──────────────────────────────────

export function clampHp(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta))
}

export function advanceTurn(
  sortedCombatants: Array<{ isUnconscious: boolean }>,
  currentIndex: number,
  currentRound: number
): { nextIndex: number; newRound: number } {
  const N = sortedCombatants.length
  if (N === 0) return { nextIndex: 0, newRound: currentRound }

  let newRound = currentRound

  for (let i = 1; i <= N; i++) {
    const candidate = (currentIndex + i) % N
    if (candidate === 0) newRound++
    if (!sortedCombatants[candidate].isUnconscious) {
      return { nextIndex: candidate, newRound }
    }
  }

  // All combatants are unconscious — hold position
  return { nextIndex: currentIndex, newRound: currentRound }
}

export function buildSortOrder(
  combatantList: Array<{ id: string; initiative: number | null }>
): Array<{ id: string; sortOrder: number }> {
  const sorted = [...combatantList].sort(
    (a, b) => (b.initiative ?? 0) - (a.initiative ?? 0)
  )
  return sorted.map((c, i) => ({ id: c.id, sortOrder: i }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMembership(campaignId: string, userId: string) {
  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
    .limit(1)
  return member ?? null
}

async function getEncounterInCampaign(encounterId: string, campaignId: string) {
  const [enc] = await db
    .select()
    .from(encounters)
    .where(and(eq(encounters.id, encounterId), eq(encounters.campaignId, campaignId)))
    .limit(1)
  return enc ?? null
}

function extractMonsterStats(data: Record<string, unknown>): { hp: number; ac: number } {
  const hp = typeof data.hit_points === 'number' ? data.hit_points : 1
  const acArr = Array.isArray(data.armor_class) ? data.armor_class : []
  const ac = acArr.length > 0 && typeof acArr[0].value === 'number' ? acArr[0].value : 10
  return { hp, ac }
}

// ── NPC Router ────────────────────────────────────────────────────────────────

export const npcsRouter = new Hono<{ Variables: Variables }>()
npcsRouter.use('*', authMiddleware)

const createNpcSchema = z.object({
  name: z.string().min(1).max(200),
  monsterIndex: z.string().min(1).nullable().optional(),
  customEntityId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
})

const patchNpcSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  monsterIndex: z.string().min(1).nullable().optional(),
  customEntityId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
})

// GET /campaigns/:id/npcs — members can list
npcsRouter.get('/:id/npcs', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const rows = await db
    .select()
    .from(npcs)
    .where(eq(npcs.campaignId, campaignId))

  return c.json(rows.map(n => ({
    id: n.id,
    name: n.name,
    monsterIndex: n.monsterIndex,
    customEntityId: n.customEntityId,
    notes: n.notes,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  })))
})

// POST /campaigns/:id/npcs — DM only
npcsRouter.post('/:id/npcs', zValidator('json', createNpcSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [npc] = await db
    .insert(npcs)
    .values({
      campaignId,
      name: body.name,
      monsterIndex: body.monsterIndex ?? null,
      customEntityId: body.customEntityId ?? null,
      notes: body.notes ?? '',
    })
    .returning()

  return c.json({
    id: npc.id,
    name: npc.name,
    monsterIndex: npc.monsterIndex,
    customEntityId: npc.customEntityId,
    notes: npc.notes,
    createdAt: npc.createdAt,
  }, 201)
})

// PATCH /campaigns/:id/npcs/:npcId — DM only
npcsRouter.patch('/:id/npcs/:npcId', zValidator('json', patchNpcSchema), async (c) => {
  const campaignId = c.req.param('id')
  const npcId = c.req.param('npcId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [existing] = await db
    .select()
    .from(npcs)
    .where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))
    .limit(1)

  if (!existing) return errorResponse(c, 404, 'NOT_FOUND')

  const [updated] = await db
    .update(npcs)
    .set({
      name: patch.name ?? existing.name,
      monsterIndex: 'monsterIndex' in patch ? (patch.monsterIndex ?? null) : existing.monsterIndex,
      customEntityId: 'customEntityId' in patch ? (patch.customEntityId ?? null) : existing.customEntityId,
      notes: patch.notes ?? existing.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))
    .returning()

  return c.json({
    id: updated.id,
    name: updated.name,
    monsterIndex: updated.monsterIndex,
    customEntityId: updated.customEntityId,
    notes: updated.notes,
    updatedAt: updated.updatedAt,
  })
})

// DELETE /campaigns/:id/npcs/:npcId — DM only
npcsRouter.delete('/:id/npcs/:npcId', async (c) => {
  const campaignId = c.req.param('id')
  const npcId = c.req.param('npcId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [existing] = await db
    .select({ id: npcs.id })
    .from(npcs)
    .where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))
    .limit(1)

  if (!existing) return errorResponse(c, 404, 'NOT_FOUND')

  await db.delete(npcs).where(and(eq(npcs.id, npcId), eq(npcs.campaignId, campaignId)))

  return c.body(null, 204)
})

// ── Encounters Router ─────────────────────────────────────────────────────────

export const encountersRouter = new Hono<{ Variables: Variables }>()
encountersRouter.use('*', authMiddleware)

const createEncounterSchema = z.object({
  name: z.string().min(1).max(200),
})

const addCombatantsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('srd_monster'),
    monsterIndex: z.string().min(1),
    count: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('player_character'),
    characterId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('custom_monster'),
    customEntityId: z.string().uuid(),
    count: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('npc'),
    npcId: z.string().uuid(),
  }),
])

const startEncounterSchema = z.object({
  initiatives: z.array(z.object({
    combatantId: z.string().uuid(),
    initiative: z.number().int(),
  })),
})

const hpDeltaSchema = z.object({
  delta: z.number().int(),
})

// GET /campaigns/:id/encounters — DM only
encountersRouter.get('/:id/encounters', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const rows = await db
    .select({
      id: encounters.id,
      name: encounters.name,
      status: encounters.status,
      round: encounters.round,
      createdAt: encounters.createdAt,
    })
    .from(encounters)
    .where(eq(encounters.campaignId, campaignId))

  // Get combatant counts per encounter
  const encIds = rows.map(r => r.id)
  const countMap = new Map<string, number>()

  if (encIds.length > 0) {
    const countRows = await db
      .select({ encounterId: combatants.encounterId, combatantCount: count() })
      .from(combatants)
      .where(inArray(combatants.encounterId, encIds))
      .groupBy(combatants.encounterId)

    for (const r of countRows) {
      countMap.set(r.encounterId, Number(r.combatantCount))
    }
  }

  return c.json(rows.map(enc => ({
    ...enc,
    combatantCount: countMap.get(enc.id) ?? 0,
  })))
})

// POST /campaigns/:id/encounters — DM only
encountersRouter.post('/:id/encounters', zValidator('json', createEncounterSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const { name } = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [enc] = await db
    .insert(encounters)
    .values({ campaignId, name })
    .returning()

  return c.json({ id: enc.id, name: enc.name, status: enc.status, round: enc.round }, 201)
})

// GET /campaigns/:id/encounters/:encId — DM only
encountersRouter.get('/:id/encounters/:encId', async (c) => {
  const campaignId = c.req.param('id')
  const encId = c.req.param('encId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const enc = await getEncounterInCampaign(encId, campaignId)
  if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

  const combatantRows = await db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encId))
    .orderBy(combatants.sortOrder)

  return c.json({
    id: enc.id,
    name: enc.name,
    status: enc.status,
    round: enc.round,
    currentTurnIndex: enc.currentTurnIndex,
    combatants: combatantRows.map(cb => ({
      id: cb.id,
      displayName: cb.displayName,
      type: cb.type,
      monsterIndex: cb.monsterIndex,
      characterId: cb.characterId,
      customEntityId: cb.customEntityId,
      npcId: cb.npcId,
      initiative: cb.initiative,
      currentHp: cb.currentHp,
      maxHp: cb.maxHp,
      armorClass: cb.armorClass,
      isUnconscious: cb.isUnconscious,
      sortOrder: cb.sortOrder,
    })),
  })
})

// DELETE /campaigns/:id/encounters/:encId — DM only
encountersRouter.delete('/:id/encounters/:encId', async (c) => {
  const campaignId = c.req.param('id')
  const encId = c.req.param('encId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const enc = await getEncounterInCampaign(encId, campaignId)
  if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

  await db.delete(encounters).where(eq(encounters.id, encId))

  return c.body(null, 204)
})

// POST /campaigns/:id/encounters/:encId/combatants — DM only
encountersRouter.post(
  '/:id/encounters/:encId/combatants',
  zValidator('json', addCombatantsSchema),
  async (c) => {
    const campaignId = c.req.param('id')
    const encId = c.req.param('encId')
    const { sub: userId } = c.get('user')
    const body = c.req.valid('json')

    const member = await getMembership(campaignId, userId)
    if (!member) return errorResponse(c, 404, 'NOT_FOUND')
    if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

    const enc = await getEncounterInCampaign(encId, campaignId)
    if (!enc) return errorResponse(c, 404, 'NOT_FOUND')
    if (enc.status !== 'preparing') return errorResponse(c, 409, 'ENCOUNTER_ALREADY_STARTED')

    const newCombatants: Array<typeof combatants.$inferInsert> = []

    if (body.type === 'srd_monster') {
      const [monster] = await db
        .select({ data: srdMonsters.data, name: srdMonsters.name })
        .from(srdMonsters)
        .where(eq(srdMonsters.index, body.monsterIndex))
        .limit(1)

      if (!monster) return errorResponse(c, 404, 'MONSTER_NOT_FOUND')

      const { hp, ac } = extractMonsterStats(monster.data as Record<string, unknown>)
      const requestedCount = body.count ?? 1

      // Find existing count for auto-numbering
      const existing = await db
        .select({ count: count() })
        .from(combatants)
        .where(and(eq(combatants.encounterId, encId), eq(combatants.monsterIndex, body.monsterIndex)))

      const existingCount = Number(existing[0]?.count ?? 0)

      for (let i = 0; i < requestedCount; i++) {
        const num = existingCount + i + 1
        newCombatants.push({
          encounterId: encId,
          type: 'srd_monster',
          monsterIndex: body.monsterIndex,
          displayName: requestedCount === 1 && existingCount === 0
            ? monster.name
            : `${monster.name} ${num}`,
          maxHp: hp,
          currentHp: hp,
          armorClass: ac,
        })
      }
    } else if (body.type === 'player_character') {
      const [char] = await db
        .select()
        .from(characters)
        .where(and(eq(characters.id, body.characterId), eq(characters.campaignId, campaignId)))
        .limit(1)

      if (!char) return errorResponse(c, 404, 'NOT_FOUND')

      newCombatants.push({
        encounterId: encId,
        type: 'player_character',
        characterId: body.characterId,
        displayName: `${char.name} (PC)`,
        maxHp: char.maxHp,
        currentHp: char.currentHp,
        armorClass: char.armorClass,
      })
    } else if (body.type === 'custom_monster') {
      const [entity] = await db
        .select()
        .from(customEntities)
        .where(
          and(
            eq(customEntities.id, body.customEntityId),
            eq(customEntities.campaignId, campaignId),
            eq(customEntities.entityType, 'monster')
          )
        )
        .limit(1)

      if (!entity) return errorResponse(c, 404, 'NOT_FOUND')

      const { hp, ac } = extractMonsterStats(entity.data as Record<string, unknown>)
      const requestedCount = body.count ?? 1

      const existing = await db
        .select({ count: count() })
        .from(combatants)
        .where(and(eq(combatants.encounterId, encId), eq(combatants.customEntityId, body.customEntityId)))

      const existingCount = Number(existing[0]?.count ?? 0)

      for (let i = 0; i < requestedCount; i++) {
        const num = existingCount + i + 1
        newCombatants.push({
          encounterId: encId,
          type: 'custom_monster',
          customEntityId: body.customEntityId,
          displayName: requestedCount === 1 && existingCount === 0
            ? entity.name
            : `${entity.name} ${num}`,
          maxHp: hp,
          currentHp: hp,
          armorClass: ac,
        })
      }
    } else if (body.type === 'npc') {
      const [npc] = await db
        .select()
        .from(npcs)
        .where(and(eq(npcs.id, body.npcId), eq(npcs.campaignId, campaignId)))
        .limit(1)

      if (!npc) return errorResponse(c, 404, 'NOT_FOUND')

      let hp = 1
      let ac = 10

      if (npc.monsterIndex) {
        const [monster] = await db
          .select({ data: srdMonsters.data })
          .from(srdMonsters)
          .where(eq(srdMonsters.index, npc.monsterIndex))
          .limit(1)

        if (monster) {
          const stats = extractMonsterStats(monster.data as Record<string, unknown>)
          hp = stats.hp
          ac = stats.ac
        }
      } else if (npc.customEntityId) {
        const [entity] = await db
          .select({ data: customEntities.data })
          .from(customEntities)
          .where(eq(customEntities.id, npc.customEntityId))
          .limit(1)

        if (entity) {
          const stats = extractMonsterStats(entity.data as Record<string, unknown>)
          hp = stats.hp
          ac = stats.ac
        }
      }

      newCombatants.push({
        encounterId: encId,
        type: 'npc',
        npcId: body.npcId,
        displayName: npc.name,
        maxHp: hp,
        currentHp: hp,
        armorClass: ac,
      })
    }

    const created = await db.insert(combatants).values(newCombatants).returning()

    return c.json(
      created.map(cb => ({
        id: cb.id,
        displayName: cb.displayName,
        type: cb.type,
        maxHp: cb.maxHp,
        currentHp: cb.currentHp,
        armorClass: cb.armorClass,
      })),
      201
    )
  }
)

// POST /campaigns/:id/encounters/:encId/start — DM only
encountersRouter.post(
  '/:id/encounters/:encId/start',
  zValidator('json', startEncounterSchema),
  async (c) => {
    const campaignId = c.req.param('id')
    const encId = c.req.param('encId')
    const { sub: userId } = c.get('user')
    const { initiatives } = c.req.valid('json')

    const member = await getMembership(campaignId, userId)
    if (!member) return errorResponse(c, 404, 'NOT_FOUND')
    if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

    const enc = await getEncounterInCampaign(encId, campaignId)
    if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

    // Apply initiative values
    for (const { combatantId, initiative } of initiatives) {
      await db
        .update(combatants)
        .set({ initiative })
        .where(and(eq(combatants.id, combatantId), eq(combatants.encounterId, encId)))
    }

    // Fetch all combatants, compute sort order by initiative descending
    const allCombatants = await db
      .select({ id: combatants.id, initiative: combatants.initiative })
      .from(combatants)
      .where(eq(combatants.encounterId, encId))

    const sortOrders = buildSortOrder(allCombatants)
    for (const { id, sortOrder } of sortOrders) {
      await db
        .update(combatants)
        .set({ sortOrder })
        .where(eq(combatants.id, id))
    }

    // Mark encounter as active
    const [updated] = await db
      .update(encounters)
      .set({ status: 'active', currentTurnIndex: 0, updatedAt: new Date() })
      .where(eq(encounters.id, encId))
      .returning()

    const sortedCombatants = await db
      .select()
      .from(combatants)
      .where(eq(combatants.encounterId, encId))
      .orderBy(combatants.sortOrder)

    return c.json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      round: updated.round,
      currentTurnIndex: updated.currentTurnIndex,
      combatants: sortedCombatants.map(cb => ({
        id: cb.id,
        displayName: cb.displayName,
        type: cb.type,
        initiative: cb.initiative,
        currentHp: cb.currentHp,
        maxHp: cb.maxHp,
        armorClass: cb.armorClass,
        isUnconscious: cb.isUnconscious,
        sortOrder: cb.sortOrder,
      })),
    })
  }
)

// POST /campaigns/:id/encounters/:encId/combatants/:combId/hp — DM only
encountersRouter.post(
  '/:id/encounters/:encId/combatants/:combId/hp',
  zValidator('json', hpDeltaSchema),
  async (c) => {
    const campaignId = c.req.param('id')
    const encId = c.req.param('encId')
    const combId = c.req.param('combId')
    const { sub: userId } = c.get('user')
    const { delta } = c.req.valid('json')

    const member = await getMembership(campaignId, userId)
    if (!member) return errorResponse(c, 404, 'NOT_FOUND')
    if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

    const enc = await getEncounterInCampaign(encId, campaignId)
    if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

    const [combatant] = await db
      .select()
      .from(combatants)
      .where(and(eq(combatants.id, combId), eq(combatants.encounterId, encId)))
      .limit(1)

    if (!combatant) return errorResponse(c, 404, 'NOT_FOUND')

    const newHp = clampHp(combatant.currentHp, delta, combatant.maxHp)
    const isUnconscious = newHp === 0

    const [updated] = await db
      .update(combatants)
      .set({ currentHp: newHp, isUnconscious })
      .where(eq(combatants.id, combId))
      .returning()

    return c.json({
      combatantId: updated.id,
      currentHp: updated.currentHp,
      isUnconscious: updated.isUnconscious,
    })
  }
)

// POST /campaigns/:id/encounters/:encId/next-turn — DM only
encountersRouter.post('/:id/encounters/:encId/next-turn', async (c) => {
  const campaignId = c.req.param('id')
  const encId = c.req.param('encId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const enc = await getEncounterInCampaign(encId, campaignId)
  if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

  const sortedCombatants = await db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encId))
    .orderBy(combatants.sortOrder)

  const { nextIndex, newRound } = advanceTurn(
    sortedCombatants,
    enc.currentTurnIndex,
    enc.round
  )

  const [updated] = await db
    .update(encounters)
    .set({ currentTurnIndex: nextIndex, round: newRound, updatedAt: new Date() })
    .where(eq(encounters.id, encId))
    .returning()

  const activeCombatant = sortedCombatants[nextIndex]

  return c.json({
    currentTurnIndex: updated.currentTurnIndex,
    round: updated.round,
    activeCombatant: activeCombatant
      ? { id: activeCombatant.id, displayName: activeCombatant.displayName }
      : null,
  })
})

// POST /campaigns/:id/encounters/:encId/end — DM only
encountersRouter.post('/:id/encounters/:encId/end', async (c) => {
  const campaignId = c.req.param('id')
  const encId = c.req.param('encId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const enc = await getEncounterInCampaign(encId, campaignId)
  if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

  const [updated] = await db
    .update(encounters)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(encounters.id, encId))
    .returning()

  return c.json({ status: updated.status })
})

// POST /campaigns/:id/encounters/:encId/reset — DM only
encountersRouter.post('/:id/encounters/:encId/reset', async (c) => {
  const campaignId = c.req.param('id')
  const encId = c.req.param('encId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const enc = await getEncounterInCampaign(encId, campaignId)
  if (!enc) return errorResponse(c, 404, 'NOT_FOUND')

  // Restore all combatants to max HP, clear initiative, reset unconscious
  const allCombatants = await db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encId))

  for (const cb of allCombatants) {
    await db
      .update(combatants)
      .set({ currentHp: cb.maxHp, initiative: null, isUnconscious: false, sortOrder: 0 })
      .where(eq(combatants.id, cb.id))
  }

  const [updated] = await db
    .update(encounters)
    .set({ status: 'preparing', currentTurnIndex: 0, round: 1, updatedAt: new Date() })
    .where(eq(encounters.id, encId))
    .returning()

  return c.json({ status: updated.status, round: updated.round })
})
