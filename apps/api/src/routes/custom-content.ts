import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import {
  db,
  campaignMembers,
  customEntities,
  srdMonsters,
  srdEquipment,
  srdMagicItems,
} from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { errorResponse } from '../lib/errors.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

// ── Zod schemas for entity data shapes ────────────────────────────────────────

export const monsterDataSchema = z.object({
  name: z.string().min(1),
  hit_points: z.number().int().min(0),
  armor_class: z.array(z.object({ value: z.number(), type: z.string().optional() })).min(1),
  challenge_rating: z.number().min(0),
  size: z.string().optional(),
  type: z.string().optional(),
  alignment: z.string().optional(),
  hit_dice: z.string().optional(),
  speed: z.record(z.unknown()).optional(),
  strength: z.number().int().optional(),
  dexterity: z.number().int().optional(),
  constitution: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  wisdom: z.number().int().optional(),
  charisma: z.number().int().optional(),
  xp: z.number().int().optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  special_abilities: z.array(z.record(z.unknown())).optional(),
}).passthrough()

export const itemDataSchema = z.object({
  name: z.string().min(1),
  equipment_category: z.string().min(1),
  weapon_category: z.string().optional(),
  damage: z.record(z.unknown()).optional(),
  rarity: z.string().optional(),
  requires_attunement: z.boolean().optional(),
  desc: z.union([z.string(), z.array(z.string())]).optional(),
}).passthrough()

export const ruleDataSchema = z.object({
  name: z.string().min(1),
  desc: z.string().min(1),
}).passthrough()

export function validateEntityData(
  entityType: 'monster' | 'item' | 'rule',
  data: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const schema = entityType === 'monster' ? monsterDataSchema
    : entityType === 'item' ? itemDataSchema
    : ruleDataSchema
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false, error: result.error.issues.map(i => i.message).join('; ') }
  }
  return { success: true, data: result.data as Record<string, unknown> }
}

// ── Deep merge helper ─────────────────────────────────────────────────────────

export function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      )
    } else {
      result[key] = value
    }
  }
  return result
}

// ── SRD lookup ────────────────────────────────────────────────────────────────

async function lookupSrdBase(
  entityType: 'monster' | 'item' | 'rule',
  baseIndex: string
): Promise<Record<string, unknown> | null> {
  if (entityType === 'monster') {
    const [row] = await db
      .select({ data: srdMonsters.data })
      .from(srdMonsters)
      .where(eq(srdMonsters.index, baseIndex))
      .limit(1)
    return row ? (row.data as Record<string, unknown>) : null
  }
  if (entityType === 'item') {
    // Try srd_equipment first, then srd_magic_items
    const [equipRow] = await db
      .select({ data: srdEquipment.data })
      .from(srdEquipment)
      .where(eq(srdEquipment.index, baseIndex))
      .limit(1)
    if (equipRow) return equipRow.data as Record<string, unknown>

    const [magicRow] = await db
      .select({ data: srdMagicItems.data })
      .from(srdMagicItems)
      .where(eq(srdMagicItems.index, baseIndex))
      .limit(1)
    return magicRow ? (magicRow.data as Record<string, unknown>) : null
  }
  return null // rules have no SRD base
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

// ── Router ────────────────────────────────────────────────────────────────────

export const customContentRouter = new Hono<{ Variables: Variables }>()
customContentRouter.use('*', authMiddleware)

const createSchema = z.object({
  entityType: z.enum(['monster', 'item', 'rule']),
  name: z.string().min(1).max(200),
  baseIndex: z.string().min(1).nullable().optional(),
  data: z.record(z.unknown()),
})

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  data: z.record(z.unknown()).optional(),
})

// GET /campaigns/:id/custom-content
customContentRouter.get('/:id/custom-content', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const typeFilter = c.req.query('type') as 'monster' | 'item' | 'rule' | undefined

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const conditions = [eq(customEntities.campaignId, campaignId)]
  if (typeFilter && ['monster', 'item', 'rule'].includes(typeFilter)) {
    conditions.push(eq(customEntities.entityType, typeFilter))
  }

  const rows = await db
    .select({
      id: customEntities.id,
      entityType: customEntities.entityType,
      name: customEntities.name,
      baseIndex: customEntities.baseIndex,
      createdAt: customEntities.createdAt,
    })
    .from(customEntities)
    .where(and(...conditions))

  return c.json(rows)
})

// GET /campaigns/:id/custom-content/:entityId
customContentRouter.get('/:id/custom-content/:entityId', async (c) => {
  const campaignId = c.req.param('id')
  const entityId = c.req.param('entityId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [entity] = await db
    .select()
    .from(customEntities)
    .where(and(eq(customEntities.id, entityId), eq(customEntities.campaignId, campaignId)))
    .limit(1)

  if (!entity) return errorResponse(c, 404, 'NOT_FOUND')

  return c.json({
    id: entity.id,
    entityType: entity.entityType,
    name: entity.name,
    baseIndex: entity.baseIndex,
    data: entity.data,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  })
})

// POST /campaigns/:id/custom-content
customContentRouter.post('/:id/custom-content', zValidator('json', createSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  let entityData = body.data

  // Handle clone from SRD
  if (body.baseIndex) {
    if (body.entityType === 'rule') {
      return errorResponse(c, 400, 'VALIDATION_ERROR')
    }
    const baseData = await lookupSrdBase(body.entityType, body.baseIndex)
    if (!baseData) return errorResponse(c, 404, 'BASE_NOT_FOUND')
    entityData = deepMerge(baseData, body.data)
  }

  // Validate entity data shape
  const validation = validateEntityData(body.entityType, { ...entityData, name: body.name })
  if (!validation.success) {
    return c.json({ error: 'VALIDATION_ERROR', detail: validation.error }, 400)
  }

  const [entity] = await db
    .insert(customEntities)
    .values({
      campaignId,
      creatorId: userId,
      entityType: body.entityType,
      name: body.name,
      baseIndex: body.baseIndex ?? null,
      data: entityData,
    })
    .returning()

  return c.json(
    { id: entity.id, entityType: entity.entityType, name: entity.name, baseIndex: entity.baseIndex },
    201
  )
})

// PATCH /campaigns/:id/custom-content/:entityId
customContentRouter.patch(
  '/:id/custom-content/:entityId',
  zValidator('json', patchSchema),
  async (c) => {
    const campaignId = c.req.param('id')
    const entityId = c.req.param('entityId')
    const { sub: userId } = c.get('user')
    const patch = c.req.valid('json')

    const member = await getMembership(campaignId, userId)
    if (!member) return errorResponse(c, 404, 'NOT_FOUND')
    if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

    const [entity] = await db
      .select()
      .from(customEntities)
      .where(and(eq(customEntities.id, entityId), eq(customEntities.campaignId, campaignId)))
      .limit(1)

    if (!entity) return errorResponse(c, 404, 'NOT_FOUND')

    const newName = patch.name ?? entity.name
    const newData = patch.data
      ? deepMerge(entity.data as Record<string, unknown>, patch.data)
      : (entity.data as Record<string, unknown>)

    // Re-validate after merge
    const validation = validateEntityData(entity.entityType, { ...newData, name: newName })
    if (!validation.success) {
      return c.json({ error: 'VALIDATION_ERROR', detail: validation.error }, 400)
    }

    const [updated] = await db
      .update(customEntities)
      .set({ name: newName, data: newData, updatedAt: new Date() })
      .where(and(eq(customEntities.id, entityId), eq(customEntities.campaignId, campaignId)))
      .returning()

    return c.json({ id: updated.id, name: updated.name, data: updated.data })
  }
)

// DELETE /campaigns/:id/custom-content/:entityId
customContentRouter.delete('/:id/custom-content/:entityId', async (c) => {
  const campaignId = c.req.param('id')
  const entityId = c.req.param('entityId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [entity] = await db
    .select({ id: customEntities.id })
    .from(customEntities)
    .where(and(eq(customEntities.id, entityId), eq(customEntities.campaignId, campaignId)))
    .limit(1)

  if (!entity) return errorResponse(c, 404, 'NOT_FOUND')

  await db
    .delete(customEntities)
    .where(and(eq(customEntities.id, entityId), eq(customEntities.campaignId, campaignId)))

  return c.body(null, 204)
})
