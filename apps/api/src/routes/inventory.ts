import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, count, inArray } from 'drizzle-orm'
import {
  db,
  characters,
  campaignMembers,
  inventoryItems,
  characterCurrency,
  srdEquipment,
  srdMagicItems,
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

// ── Pure utils ────────────────────────────────────────────────────────────────

export function computeCarryWeight(
  items: Array<{ weight: number | null; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0)
}

export function computeCarryCapacity(strScore: number): number {
  return strScore * 15
}

function formatCost(data: Record<string, unknown>): string | null {
  const cost = data.cost as { quantity?: number; unit?: string } | undefined
  if (!cost?.quantity || !cost?.unit) return null
  return `${cost.quantity} ${cost.unit}`
}

async function buildInventoryResponse(characterId: string, strScore: number) {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.characterId, characterId))

  // Batch-fetch needed SRD entries
  const equipIndexes = rows.map((r) => r.srdEquipmentIndex).filter((x): x is string => !!x)
  const magicIndexes = rows.map((r) => r.srdMagicItemIndex).filter((x): x is string => !!x)

  const equipMap = new Map<string, { name: string; data: Record<string, unknown> }>()
  const magicMap = new Map<string, { name: string }>()

  if (equipIndexes.length > 0) {
    const equipRows = await db
      .select({ index: srdEquipment.index, name: srdEquipment.name, data: srdEquipment.data })
      .from(srdEquipment)
      .where(inArray(srdEquipment.index, equipIndexes))
    for (const r of equipRows) {
      equipMap.set(r.index, { name: r.name, data: r.data as Record<string, unknown> })
    }
  }

  if (magicIndexes.length > 0) {
    const magicRows = await db
      .select({ index: srdMagicItems.index, name: srdMagicItems.name })
      .from(srdMagicItems)
      .where(inArray(srdMagicItems.index, magicIndexes))
    for (const r of magicRows) {
      magicMap.set(r.index, { name: r.name })
    }
  }

  const items = rows.map((row) => {
    let name: string
    let source: 'srd_equipment' | 'srd_magic_item' | 'custom'
    let weight: number | null = null
    let cost: string | null = null
    let srdIndex: string | null = null
    let weaponDamage: string | null = null
    let weaponDamageType: string | null = null
    let weaponRange: string | null = null
    let armorBaseAc: number | null = null
    let armorDexBonus: boolean | null = null
    let equipmentCategory: string | null = null

    if (row.srdEquipmentIndex) {
      const eq = equipMap.get(row.srdEquipmentIndex)
      name = eq?.name ?? row.srdEquipmentIndex
      source = 'srd_equipment'
      srdIndex = row.srdEquipmentIndex
      if (eq) {
        const w = (eq.data.weight as number | undefined)
        weight = typeof w === 'number' ? w : null
        cost = formatCost(eq.data)

        // Extract weapon stats
        const damage = eq.data.damage as { damage_dice?: string; damage_type?: { name: string } } | undefined
        if (damage?.damage_dice) weaponDamage = damage.damage_dice
        if (damage?.damage_type?.name) weaponDamageType = damage.damage_type.name
        const range = eq.data.weapon_range as string | undefined
        if (range) weaponRange = range

        // Extract armor stats
        const ac = eq.data.armor_class as { base?: number; dex_bonus?: boolean } | undefined
        if (ac?.base !== undefined) {
          armorBaseAc = ac.base
          armorDexBonus = ac.dex_bonus ?? false
        }

        equipmentCategory = eq.data.equipment_category as string | null ?? null
        if (typeof equipmentCategory === 'object' && equipmentCategory !== null) {
          equipmentCategory = (equipmentCategory as { name?: string }).name ?? null
        }
      }
    } else if (row.srdMagicItemIndex) {
      const mi = magicMap.get(row.srdMagicItemIndex)
      name = mi?.name ?? row.srdMagicItemIndex
      source = 'srd_magic_item'
      srdIndex = row.srdMagicItemIndex
    } else {
      name = row.customName ?? 'Unknown'
      source = 'custom'
      weight = row.customWeight ?? null
    }

    return {
      id: row.id,
      name,
      source,
      srdIndex,
      quantity: row.quantity,
      weight,
      isEquipped: row.isEquipped,
      isAttuned: row.isAttuned,
      cost,
      notes: row.notes,
      customDescription: source === 'custom' ? row.customDescription : undefined,
      weaponDamage,
      weaponDamageType,
      weaponRange,
      armorBaseAc,
      armorDexBonus,
      equipmentCategory,
    }
  })

  const [currencyRow] = await db
    .select()
    .from(characterCurrency)
    .where(eq(characterCurrency.characterId, characterId))
    .limit(1)

  const currency = currencyRow
    ? { pp: currencyRow.pp, gp: currencyRow.gp, ep: currencyRow.ep, sp: currencyRow.sp, cp: currencyRow.cp }
    : { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }

  const carryWeight = computeCarryWeight(items)
  const carryCapacity = computeCarryCapacity(strScore)

  return { items, currency, carryWeight, carryCapacity }
}

// ── Validation schemas ────────────────────────────────────────────────────────

const addItemSchema = z
  .object({
    srdEquipmentIndex: z.string().min(1).optional(),
    srdMagicItemIndex: z.string().min(1).optional(),
    customName: z.string().min(1).max(200).optional(),
    customDescription: z.string().optional(),
    customWeight: z.number().min(0).optional(),
    quantity: z.number().int().min(1).default(1),
    notes: z.string().optional(),
  })
  .refine(
    (d) => !!(d.srdEquipmentIndex || d.srdMagicItemIndex || d.customName),
    { message: 'One of srdEquipmentIndex, srdMagicItemIndex, or customName is required' }
  )

const patchItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  isEquipped: z.boolean().optional(),
  isAttuned: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

const currencySchema = z.object({
  pp: z.number().int().min(0),
  gp: z.number().int().min(0),
  ep: z.number().int().min(0),
  sp: z.number().int().min(0),
  cp: z.number().int().min(0),
})

// ── Router ────────────────────────────────────────────────────────────────────

export const inventoryRouter = new Hono<{ Variables: Variables }>()
inventoryRouter.use('*', authMiddleware)

// GET /characters/:id/inventory
inventoryRouter.get('/:id/inventory', async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  const response = await buildInventoryResponse(characterId, char.str)
  return c.json(response)
})

// POST /characters/:id/inventory
inventoryRouter.post('/:id/inventory', zValidator('json', addItemSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const data = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  // Validate SRD indexes exist if provided
  if (data.srdEquipmentIndex) {
    const [found] = await db
      .select({ index: srdEquipment.index })
      .from(srdEquipment)
      .where(eq(srdEquipment.index, data.srdEquipmentIndex))
      .limit(1)
    if (!found) return errorResponse(c, 404, 'ITEM_NOT_FOUND')
  }

  if (data.srdMagicItemIndex) {
    const [found] = await db
      .select({ index: srdMagicItems.index })
      .from(srdMagicItems)
      .where(eq(srdMagicItems.index, data.srdMagicItemIndex))
      .limit(1)
    if (!found) return errorResponse(c, 404, 'ITEM_NOT_FOUND')
  }

  const [item] = await db
    .insert(inventoryItems)
    .values({
      characterId,
      srdEquipmentIndex: data.srdEquipmentIndex ?? null,
      srdMagicItemIndex: data.srdMagicItemIndex ?? null,
      customName: data.customName ?? null,
      customDescription: data.customDescription ?? null,
      customWeight: data.customWeight ?? null,
      quantity: data.quantity,
      notes: data.notes ?? null,
    })
    .returning()

  return c.json(item, 201)
})

// PATCH /characters/:id/inventory/:itemId
inventoryRouter.patch('/:id/inventory/:itemId', zValidator('json', patchItemSchema), async (c) => {
  const characterId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [existingItem] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.characterId, characterId)))
    .limit(1)

  if (!existingItem) return errorResponse(c, 404, 'NOT_FOUND')

  // Check attunement limit when trying to attune
  if (patch.isAttuned === true && !existingItem.isAttuned) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.characterId, characterId), eq(inventoryItems.isAttuned, true)))

    if (Number(value) >= 3) {
      return errorResponse(c, 409, 'ATTUNEMENT_SLOTS_FULL')
    }
  }

  const updateData: Record<string, unknown> = {}
  if (patch.quantity !== undefined) updateData.quantity = patch.quantity
  if (patch.isEquipped !== undefined) updateData.isEquipped = patch.isEquipped
  if (patch.isAttuned !== undefined) updateData.isAttuned = patch.isAttuned
  if (patch.notes !== undefined) updateData.notes = patch.notes

  const [updated] = await db
    .update(inventoryItems)
    .set(updateData)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.characterId, characterId)))
    .returning()

  return c.json(updated)
})

// DELETE /characters/:id/inventory/:itemId
inventoryRouter.delete('/:id/inventory/:itemId', async (c) => {
  const characterId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [existingItem] = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.characterId, characterId)))
    .limit(1)

  if (!existingItem) return errorResponse(c, 404, 'NOT_FOUND')

  await db
    .delete(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.characterId, characterId)))

  return c.body(null, 204)
})

// PUT /characters/:id/currency
inventoryRouter.put('/:id/currency', zValidator('json', currencySchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const data = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [result] = await db
    .insert(characterCurrency)
    .values({ characterId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: characterCurrency.characterId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning()

  return c.json({
    pp: result.pp,
    gp: result.gp,
    ep: result.ep,
    sp: result.sp,
    cp: result.cp,
  })
})
