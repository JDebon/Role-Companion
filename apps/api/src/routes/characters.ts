import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, characters, campaignMembers } from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { errorResponse } from '../lib/errors.js'
import {
  buildFullSheet,
  defaultSkillProficiencies,
  defaultSavingThrowProficiencies,
  SKILLS,
  ABILITIES,
  type ProficiencyLevel,
} from '../lib/character-utils.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

// ── Shared helper ────────────────────────────────────────────────────────────

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

// ── Validation schemas ────────────────────────────────────────────────────────

const abilityScore = z.number().int().min(1).max(30)
const proficiencyLevel = z.enum(['none', 'proficient', 'expertise'])

const createSchema = z
  .object({
    name: z.string().min(1).max(100),
    className: z.string().min(1).max(100),
    subclassName: z.string().max(100).nullable().optional(),
    raceName: z.string().min(1).max(100),
    backgroundName: z.string().min(1).max(100).optional().default(''),
    level: z.number().int().min(1).max(20).optional().default(1),
    experiencePoints: z.number().int().min(0).optional().default(0),
    str: abilityScore.optional().default(10),
    dex: abilityScore.optional().default(10),
    con: abilityScore.optional().default(10),
    int: abilityScore.optional().default(10),
    wis: abilityScore.optional().default(10),
    cha: abilityScore.optional().default(10),
    maxHp: z.number().int().min(0),
    currentHp: z.number().int().min(0),
    temporaryHp: z.number().int().min(0).optional().default(0),
    armorClass: z.number().int().min(0).optional().default(10),
    initiative: z.number().int().nullable().optional(),
    speed: z.number().int().min(0).optional().default(30),
    skillProficiencies: z.record(proficiencyLevel).optional(),
    savingThrowProficiencies: z.record(z.boolean()).optional(),
    backstory: z.string().nullable().optional(),
    portraitUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://'), 'Portrait URL must use HTTPS')
      .nullable()
      .optional(),
    traits: z.array(z.string()).optional().default([]),
  })
  .refine((d) => d.currentHp <= d.maxHp, {
    message: 'currentHp cannot exceed maxHp',
    path: ['currentHp'],
  })

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  className: z.string().min(1).max(100).optional(),
  subclassName: z.string().max(100).nullable().optional(),
  raceName: z.string().min(1).max(100).optional(),
  backgroundName: z.string().min(1).max(100).optional(),
  level: z.number().int().min(1).max(20).optional(),
  experiencePoints: z.number().int().min(0).optional(),
  str: abilityScore.optional(),
  dex: abilityScore.optional(),
  con: abilityScore.optional(),
  int: abilityScore.optional(),
  wis: abilityScore.optional(),
  cha: abilityScore.optional(),
  maxHp: z.number().int().min(0).optional(),
  currentHp: z.number().int().min(0).optional(),
  temporaryHp: z.number().int().min(0).optional(),
  armorClass: z.number().int().min(0).optional(),
  initiative: z.number().int().nullable().optional(),
  speed: z.number().int().min(0).optional(),
  skillProficiencies: z.record(proficiencyLevel).optional(),
  savingThrowProficiencies: z.record(z.boolean()).optional(),
  backstory: z.string().nullable().optional(),
  portraitUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), 'Portrait URL must use HTTPS')
    .nullable()
    .optional(),
  traits: z.array(z.string()).optional(),
})

// ── Campaign-scoped router (mount at /api/v1/campaigns) ──────────────────────

const campaignCharactersRouter = new Hono<{ Variables: Variables }>()
campaignCharactersRouter.use('*', authMiddleware)

// GET /campaigns/:id/characters
campaignCharactersRouter.get('/:id/characters', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const rows = await db
    .select()
    .from(characters)
    .where(eq(characters.campaignId, campaignId))

  return c.json(
    rows.map((ch) => ({
      id: ch.id,
      name: ch.name,
      className: ch.className,
      raceName: ch.raceName,
      level: ch.level,
      currentHp: ch.currentHp,
      maxHp: ch.maxHp,
      userId: ch.userId,
    }))
  )
})

// POST /campaigns/:id/characters
campaignCharactersRouter.post(
  '/:id/characters',
  zValidator('json', createSchema),
  async (c) => {
    const campaignId = c.req.param('id')
    const { sub: userId } = c.get('user')
    const data = c.req.valid('json')

    const member = await getMembership(campaignId, userId)
    if (!member) return errorResponse(c, 404, 'NOT_FOUND')

    const skillProf: Record<string, ProficiencyLevel> = {
      ...defaultSkillProficiencies(),
      ...(data.skillProficiencies ?? {}),
    }
    // Sanitize: only keep known skills
    for (const key of Object.keys(skillProf)) {
      if (!SKILLS[key]) delete skillProf[key]
    }

    const savingThrowProf: Record<string, boolean> = {
      ...defaultSavingThrowProficiencies(),
      ...(data.savingThrowProficiencies ?? {}),
    }
    // Sanitize: only keep known abilities
    for (const key of Object.keys(savingThrowProf)) {
      if (!ABILITIES.includes(key as typeof ABILITIES[number])) delete savingThrowProf[key]
    }

    const [char] = await db
      .insert(characters)
      .values({
        campaignId,
        userId,
        name: data.name,
        className: data.className,
        subclassName: data.subclassName ?? null,
        raceName: data.raceName,
        backgroundName: data.backgroundName,
        level: data.level,
        experiencePoints: data.experiencePoints,
        str: data.str,
        dex: data.dex,
        con: data.con,
        int: data.int,
        wis: data.wis,
        cha: data.cha,
        maxHp: data.maxHp,
        currentHp: data.currentHp,
        temporaryHp: data.temporaryHp,
        armorClass: data.armorClass,
        initiative: data.initiative ?? null,
        speed: data.speed,
        skillProficiencies: skillProf,
        savingThrowProficiencies: savingThrowProf,
        backstory: data.backstory ?? null,
        portraitUrl: data.portraitUrl ?? null,
        traits: data.traits,
      })
      .returning()

    return c.json(buildFullSheet(char), 201)
  }
)

// ── Character-scoped router (mount at /api/v1/characters) ───────────────────

const charactersRouter = new Hono<{ Variables: Variables }>()
charactersRouter.use('*', authMiddleware)

// GET /characters/:id
charactersRouter.get('/:id', async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  return c.json(buildFullSheet(char))
})

// PATCH /characters/:id
charactersRouter.patch('/:id', zValidator('json', patchSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const { char } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  // Validate HP bounds after merge
  const newMaxHp = patch.maxHp ?? char.maxHp
  const newCurrentHp = patch.currentHp ?? char.currentHp
  if (newCurrentHp > newMaxHp) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', { currentHp: 'currentHp cannot exceed maxHp' })
  }

  // Merge skill/saving throw proficiencies
  const skillProf = patch.skillProficiencies
    ? { ...char.skillProficiencies, ...patch.skillProficiencies }
    : undefined
  const savingThrowProf = patch.savingThrowProficiencies
    ? { ...char.savingThrowProficiencies, ...patch.savingThrowProficiencies }
    : undefined

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  const scalar = [
    'name', 'className', 'subclassName', 'raceName', 'backgroundName',
    'level', 'experiencePoints', 'str', 'dex', 'con', 'int', 'wis', 'cha',
    'maxHp', 'currentHp', 'temporaryHp', 'armorClass', 'initiative', 'speed',
    'backstory', 'portraitUrl', 'traits',
  ] as const
  for (const key of scalar) {
    if (key in patch && patch[key] !== undefined) {
      updateData[key] = patch[key] as unknown
    }
  }
  if (skillProf) updateData.skillProficiencies = skillProf
  if (savingThrowProf) updateData.savingThrowProficiencies = savingThrowProf

  const [updated] = await db
    .update(characters)
    .set(updateData)
    .where(eq(characters.id, characterId))
    .returning()

  return c.json(buildFullSheet(updated))
})

// DELETE /characters/:id
charactersRouter.delete('/:id', async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const { char, member } = await getCharacterWithMemberCheck(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  const isOwner = char.userId === userId
  const isDM = member.role === 'dungeon_master'

  if (!isOwner && !isDM) return errorResponse(c, 403, 'FORBIDDEN')

  await db.delete(characters).where(eq(characters.id, characterId))

  return c.body(null, 204)
})

export { campaignCharactersRouter, charactersRouter }
