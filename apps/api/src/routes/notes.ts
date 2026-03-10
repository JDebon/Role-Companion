import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, or, ilike } from 'drizzle-orm'
import { db, notes, sessionLogs, characters, campaignMembers } from '@rolecompanion/db'
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

async function getCharacterWithMembership(characterId: string, requesterId: string) {
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

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const noteCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(''),
})

const notePatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
})

const sessionLogCreateSchema = z.object({
  sessionNumber: z.number().int().positive(),
  title: z.string().min(1).max(200),
  content: z.string().default(''),
})

const sessionLogPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
})

// ── Character Notes Router ────────────────────────────────────────────────────

export const characterNotesRouter = new Hono<{ Variables: Variables }>()
characterNotesRouter.use('*', authMiddleware)

// GET /characters/:id/notes
characterNotesRouter.get('/:id/notes', async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const q = c.req.query('q')

  const { char, member } = await getCharacterWithMembership(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  // Only author or DM can read character notes
  if (char.userId !== userId && member.role !== 'dungeon_master') {
    return errorResponse(c, 403, 'FORBIDDEN')
  }

  const conditions: ReturnType<typeof eq>[] = [
    eq(notes.characterId, characterId),
    eq(notes.campaignId, char.campaignId),
  ]

  if (q) {
    conditions.push(
      or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`))!
    )
  }

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      isRevealed: notes.isRevealed,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(and(...conditions))
    .orderBy(notes.createdAt)

  return c.json(rows)
})

// GET /characters/:id/notes/:noteId
characterNotesRouter.get('/:id/notes/:noteId', async (c) => {
  const characterId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')

  const { char, member } = await getCharacterWithMembership(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  if (char.userId !== userId && member.role !== 'dungeon_master') {
    return errorResponse(c, 403, 'FORBIDDEN')
  }

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.characterId, characterId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')

  return c.json(note)
})

// POST /characters/:id/notes
characterNotesRouter.post('/:id/notes', zValidator('json', noteCreateSchema), async (c) => {
  const characterId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const { char, member } = await getCharacterWithMembership(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  // Only character owner can create notes
  if (char.userId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [note] = await db
    .insert(notes)
    .values({
      campaignId: char.campaignId,
      authorId: userId,
      characterId,
      title: body.title,
      content: body.content,
    })
    .returning()

  return c.json({ id: note.id, title: note.title, isRevealed: note.isRevealed }, 201)
})

// PATCH /characters/:id/notes/:noteId
characterNotesRouter.patch('/:id/notes/:noteId', zValidator('json', notePatchSchema), async (c) => {
  const characterId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const { char, member } = await getCharacterWithMembership(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.characterId, characterId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')
  if (note.authorId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [updated] = await db
    .update(notes)
    .set({
      title: patch.title ?? note.title,
      content: patch.content ?? note.content,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning()

  return c.json({ id: updated.id, title: updated.title, content: updated.content, updatedAt: updated.updatedAt })
})

// DELETE /characters/:id/notes/:noteId
characterNotesRouter.delete('/:id/notes/:noteId', async (c) => {
  const characterId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')

  const { char, member } = await getCharacterWithMembership(characterId, userId)
  if (!char || !member) return errorResponse(c, 404, 'NOT_FOUND')

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.characterId, characterId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')
  if (note.authorId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  await db.delete(notes).where(eq(notes.id, noteId))
  return c.body(null, 204)
})

// ── Campaign Notes Router (DM notes + reveal) ─────────────────────────────────

export const campaignNotesRouter = new Hono<{ Variables: Variables }>()
campaignNotesRouter.use('*', authMiddleware)

// GET /campaigns/:id/notes/revealed
campaignNotesRouter.get('/:id/notes/revealed', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const q = c.req.query('q')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const conditions: ReturnType<typeof eq>[] = [
    eq(notes.campaignId, campaignId),
    eq(notes.isRevealed, true),
  ]

  if (q) {
    conditions.push(
      or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`))!
    )
  }

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(notes.createdAt)

  return c.json(rows)
})

// GET /campaigns/:id/notes (DM only — lists all campaign-scope notes by this DM)
campaignNotesRouter.get('/:id/notes', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const q = c.req.query('q')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const conditions: ReturnType<typeof eq>[] = [
    eq(notes.campaignId, campaignId),
    eq(notes.authorId, userId),
  ]

  if (q) {
    conditions.push(
      or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`))!
    )
  }

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(notes.createdAt)

  return c.json(rows)
})

// POST /campaigns/:id/notes
campaignNotesRouter.post('/:id/notes', zValidator('json', noteCreateSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [note] = await db
    .insert(notes)
    .values({
      campaignId,
      authorId: userId,
      characterId: null,
      title: body.title,
      content: body.content,
    })
    .returning()

  return c.json({ id: note.id, title: note.title, isRevealed: note.isRevealed }, 201)
})

// POST /campaigns/:id/notes/:noteId/reveal
campaignNotesRouter.post('/:id/notes/:noteId/reveal', async (c) => {
  const campaignId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.campaignId, campaignId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')
  if (note.isRevealed) return errorResponse(c, 409, 'ALREADY_REVEALED')

  const [updated] = await db
    .update(notes)
    .set({ isRevealed: true, updatedAt: new Date() })
    .where(eq(notes.id, noteId))
    .returning()

  return c.json({ id: updated.id, isRevealed: updated.isRevealed })
})

// PATCH /campaigns/:id/notes/:noteId
campaignNotesRouter.patch('/:id/notes/:noteId', zValidator('json', notePatchSchema), async (c) => {
  const campaignId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.campaignId, campaignId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')
  if (note.authorId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  const [updated] = await db
    .update(notes)
    .set({
      title: patch.title ?? note.title,
      content: patch.content ?? note.content,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning()

  return c.json({ id: updated.id, title: updated.title, content: updated.content, updatedAt: updated.updatedAt })
})

// DELETE /campaigns/:id/notes/:noteId
campaignNotesRouter.delete('/:id/notes/:noteId', async (c) => {
  const campaignId = c.req.param('id')
  const noteId = c.req.param('noteId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.campaignId, campaignId)))
    .limit(1)

  if (!note) return errorResponse(c, 404, 'NOT_FOUND')
  if (note.authorId !== userId) return errorResponse(c, 403, 'FORBIDDEN')

  await db.delete(notes).where(eq(notes.id, noteId))
  return c.body(null, 204)
})

// ── Session Logs Router ────────────────────────────────────────────────────────

export const sessionLogsRouter = new Hono<{ Variables: Variables }>()
sessionLogsRouter.use('*', authMiddleware)

// GET /campaigns/:id/session-logs
sessionLogsRouter.get('/:id/session-logs', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const q = c.req.query('q')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const conditions: ReturnType<typeof eq>[] = [eq(sessionLogs.campaignId, campaignId)]
  if (q) {
    conditions.push(
      or(ilike(sessionLogs.title, `%${q}%`), ilike(sessionLogs.content, `%${q}%`))!
    )
  }

  const rows = await db
    .select({
      id: sessionLogs.id,
      sessionNumber: sessionLogs.sessionNumber,
      title: sessionLogs.title,
      isPinned: sessionLogs.isPinned,
      createdAt: sessionLogs.createdAt,
    })
    .from(sessionLogs)
    .where(and(...conditions))
    .orderBy(sessionLogs.sessionNumber)

  // Sort descending by sessionNumber
  rows.sort((a, b) => b.sessionNumber - a.sessionNumber)

  return c.json(rows)
})

// GET /campaigns/:id/session-logs/:logId
sessionLogsRouter.get('/:id/session-logs/:logId', async (c) => {
  const campaignId = c.req.param('id')
  const logId = c.req.param('logId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [log] = await db
    .select()
    .from(sessionLogs)
    .where(and(eq(sessionLogs.id, logId), eq(sessionLogs.campaignId, campaignId)))
    .limit(1)

  if (!log) return errorResponse(c, 404, 'NOT_FOUND')

  return c.json(log)
})

// POST /campaigns/:id/session-logs
sessionLogsRouter.post('/:id/session-logs', zValidator('json', sessionLogCreateSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const body = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  // Check for duplicate session number
  const [existing] = await db
    .select({ id: sessionLogs.id })
    .from(sessionLogs)
    .where(and(eq(sessionLogs.campaignId, campaignId), eq(sessionLogs.sessionNumber, body.sessionNumber)))
    .limit(1)

  if (existing) return errorResponse(c, 409, 'DUPLICATE_SESSION_NUMBER')

  const [log] = await db
    .insert(sessionLogs)
    .values({
      campaignId,
      authorId: userId,
      sessionNumber: body.sessionNumber,
      title: body.title,
      content: body.content,
    })
    .returning()

  return c.json(log, 201)
})

// PATCH /campaigns/:id/session-logs/:logId
sessionLogsRouter.patch('/:id/session-logs/:logId', zValidator('json', sessionLogPatchSchema), async (c) => {
  const campaignId = c.req.param('id')
  const logId = c.req.param('logId')
  const { sub: userId } = c.get('user')
  const patch = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [log] = await db
    .select()
    .from(sessionLogs)
    .where(and(eq(sessionLogs.id, logId), eq(sessionLogs.campaignId, campaignId)))
    .limit(1)

  if (!log) return errorResponse(c, 404, 'NOT_FOUND')

  const [updated] = await db
    .update(sessionLogs)
    .set({
      title: patch.title ?? log.title,
      content: patch.content ?? log.content,
      updatedAt: new Date(),
    })
    .where(eq(sessionLogs.id, logId))
    .returning()

  return c.json(updated)
})

// DELETE /campaigns/:id/session-logs/:logId
sessionLogsRouter.delete('/:id/session-logs/:logId', async (c) => {
  const campaignId = c.req.param('id')
  const logId = c.req.param('logId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [log] = await db
    .select({ id: sessionLogs.id })
    .from(sessionLogs)
    .where(and(eq(sessionLogs.id, logId), eq(sessionLogs.campaignId, campaignId)))
    .limit(1)

  if (!log) return errorResponse(c, 404, 'NOT_FOUND')

  await db.delete(sessionLogs).where(eq(sessionLogs.id, logId))
  return c.body(null, 204)
})

// POST /campaigns/:id/session-logs/:logId/pin
sessionLogsRouter.post('/:id/session-logs/:logId/pin', async (c) => {
  const campaignId = c.req.param('id')
  const logId = c.req.param('logId')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [log] = await db
    .select({ id: sessionLogs.id })
    .from(sessionLogs)
    .where(and(eq(sessionLogs.id, logId), eq(sessionLogs.campaignId, campaignId)))
    .limit(1)

  if (!log) return errorResponse(c, 404, 'NOT_FOUND')

  // Unpin all logs in this campaign, then pin this one
  await db
    .update(sessionLogs)
    .set({ isPinned: false })
    .where(eq(sessionLogs.campaignId, campaignId))

  const [updated] = await db
    .update(sessionLogs)
    .set({ isPinned: true, updatedAt: new Date() })
    .where(eq(sessionLogs.id, logId))
    .returning()

  return c.json({ isPinned: updated.isPinned })
})
