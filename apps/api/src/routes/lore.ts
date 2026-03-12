import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, or, ilike } from 'drizzle-orm'
import { db, loreDocuments, campaignMembers } from '@rolecompanion/db'
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

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const loreCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(''),
})

const lorePatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  isPublished: z.boolean().optional(),
})

// ── Lore Router ───────────────────────────────────────────────────────────────

export const loreRouter = new Hono<{ Variables: Variables }>()
loreRouter.use('*', authMiddleware)

// GET /campaigns/:id/lore
loreRouter.get('/:id/lore', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const q = c.req.query('q')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const conditions: ReturnType<typeof eq>[] = [eq(loreDocuments.campaignId, campaignId)]

  // Players only see published documents
  if (member.role !== 'dungeon_master') {
    conditions.push(eq(loreDocuments.isPublished, true))
  }

  if (q) {
    conditions.push(
      or(ilike(loreDocuments.title, `%${q}%`), ilike(loreDocuments.content, `%${q}%`))!
    )
  }

  const rows = await db
    .select({
      id: loreDocuments.id,
      title: loreDocuments.title,
      isPublished: loreDocuments.isPublished,
      createdAt: loreDocuments.createdAt,
      updatedAt: loreDocuments.updatedAt,
    })
    .from(loreDocuments)
    .where(and(...conditions))
    .orderBy(loreDocuments.createdAt)

  return c.json(rows)
})

// GET /campaigns/:id/lore/:docId
loreRouter.get('/:id/lore/:docId', async (c) => {
  const campaignId = c.req.param('id')
  const docId = c.req.param('docId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [doc] = await db
    .select()
    .from(loreDocuments)
    .where(and(eq(loreDocuments.id, docId), eq(loreDocuments.campaignId, campaignId)))
    .limit(1)

  if (!doc) return errorResponse(c, 404, 'NOT_FOUND')

  // Players cannot read unpublished documents
  if (!doc.isPublished && member.role !== 'dungeon_master') {
    return errorResponse(c, 403, 'FORBIDDEN')
  }

  return c.json(doc)
})

// POST /campaigns/:id/lore
loreRouter.post('/:id/lore', zValidator('json', loreCreateSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [doc] = await db
    .insert(loreDocuments)
    .values({
      campaignId,
      authorId: userId,
      title: body.title,
      content: body.content,
    })
    .returning()

  return c.json({ id: doc.id, title: doc.title, isPublished: doc.isPublished }, 201)
})

// PATCH /campaigns/:id/lore/:docId
loreRouter.patch('/:id/lore/:docId', zValidator('json', lorePatchSchema), async (c) => {
  const campaignId = c.req.param('id')
  const docId = c.req.param('docId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [doc] = await db
    .select()
    .from(loreDocuments)
    .where(and(eq(loreDocuments.id, docId), eq(loreDocuments.campaignId, campaignId)))
    .limit(1)

  if (!doc) return errorResponse(c, 404, 'NOT_FOUND')

  const [updated] = await db
    .update(loreDocuments)
    .set({
      title: patch.title ?? doc.title,
      content: patch.content ?? doc.content,
      isPublished: patch.isPublished ?? doc.isPublished,
      updatedAt: new Date(),
    })
    .where(eq(loreDocuments.id, docId))
    .returning()

  return c.json(updated)
})

// DELETE /campaigns/:id/lore/:docId
loreRouter.delete('/:id/lore/:docId', async (c) => {
  const campaignId = c.req.param('id')
  const docId = c.req.param('docId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [doc] = await db
    .select({ id: loreDocuments.id })
    .from(loreDocuments)
    .where(and(eq(loreDocuments.id, docId), eq(loreDocuments.campaignId, campaignId)))
    .limit(1)

  if (!doc) return errorResponse(c, 404, 'NOT_FOUND')

  await db.delete(loreDocuments).where(eq(loreDocuments.id, docId))
  return c.body(null, 204)
})
