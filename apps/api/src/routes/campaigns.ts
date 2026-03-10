import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db, campaigns, campaignMembers, users } from '@rolecompanion/db'
import { authMiddleware } from '../lib/auth-middleware.js'
import { generateInviteCode } from '../lib/invite.js'
import { errorResponse } from '../lib/errors.js'
import type { JwtPayload } from '../lib/jwt.js'

type Variables = { user: JwtPayload }

const router = new Hono<{ Variables: Variables }>()

router.use('*', authMiddleware)

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getMembership(campaignId: string, userId: string) {
  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(
      and(
        eq(campaignMembers.campaignId, campaignId),
        eq(campaignMembers.userId, userId)
      )
    )
    .limit(1)
  return member ?? null
}

// ── POST /campaigns ──────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
})

router.post('/', zValidator('json', createSchema), async (c) => {
  const { name } = c.req.valid('json')
  const { sub: userId } = c.get('user')

  const inviteCode = generateInviteCode()

  const [campaign] = await db
    .insert(campaigns)
    .values({ name, inviteCode })
    .returning()

  await db.insert(campaignMembers).values({
    campaignId: campaign.id,
    userId,
    role: 'dungeon_master',
  })

  return c.json(
    { id: campaign.id, name: campaign.name, inviteCode: campaign.inviteCode, role: 'dungeon_master' },
    201
  )
})

// ── GET /campaigns ───────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const { sub: userId } = c.get('user')

  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      role: campaignMembers.role,
      memberCount: sql<number>`count(*) over (partition by ${campaigns.id})`,
    })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .where(eq(campaignMembers.userId, userId))

  return c.json(rows)
})

// ── GET /campaigns/:id ───────────────────────────────────────────────────────

router.get('/:id', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)

  return c.json(campaign)
})

// ── GET /campaigns/:id/members ───────────────────────────────────────────────

router.get('/:id/members', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')

  const members = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      role: campaignMembers.role,
    })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, campaignId))

  return c.json(members)
})

// ── PATCH /campaigns/:id ─────────────────────────────────────────────────────

const updateSchema = z.object({ name: z.string().min(1).max(100) })

router.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')
  const { name } = c.req.valid('json')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const [updated] = await db
    .update(campaigns)
    .set({ name, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))
    .returning()

  return c.json(updated)
})

// ── DELETE /campaigns/:id ────────────────────────────────────────────────────

router.delete('/:id', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  await db.delete(campaigns).where(eq(campaigns.id, campaignId))

  return c.body(null, 204)
})

// ── POST /campaigns/join ─────────────────────────────────────────────────────

const joinSchema = z.object({ inviteCode: z.string().min(1) })

router.post('/join', zValidator('json', joinSchema), async (c) => {
  const { inviteCode } = c.req.valid('json')
  const { sub: userId } = c.get('user')

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.inviteCode, inviteCode))
    .limit(1)

  if (!campaign) return errorResponse(c, 400, 'INVALID_INVITE_CODE')

  if (
    campaign.inviteExpiresAt &&
    campaign.inviteExpiresAt < new Date()
  ) {
    return errorResponse(c, 400, 'INVALID_INVITE_CODE')
  }

  const existing = await getMembership(campaign.id, userId)
  if (existing) return errorResponse(c, 409, 'ALREADY_MEMBER')

  await db.insert(campaignMembers).values({
    campaignId: campaign.id,
    userId,
    role: 'player',
  })

  return c.json({ id: campaign.id, name: campaign.name, role: 'player' })
})

// ── POST /campaigns/:id/invite/regenerate ────────────────────────────────────

router.post('/:id/invite/regenerate', async (c) => {
  const campaignId = c.req.param('id')
  const { sub: userId } = c.get('user')

  const member = await getMembership(campaignId, userId)
  if (!member) return errorResponse(c, 404, 'NOT_FOUND')
  if (member.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  const newCode = generateInviteCode()

  await db
    .update(campaigns)
    .set({ inviteCode: newCode, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId))

  return c.json({ inviteCode: newCode })
})

// ── DELETE /campaigns/:id/members/:userId ────────────────────────────────────

router.delete('/:id/members/:targetUserId', async (c) => {
  const campaignId = c.req.param('id')
  const targetUserId = c.req.param('targetUserId')
  const { sub: requesterId } = c.get('user')

  const requesterMember = await getMembership(campaignId, requesterId)
  if (!requesterMember) return errorResponse(c, 404, 'NOT_FOUND')
  if (requesterMember.role !== 'dungeon_master') return errorResponse(c, 403, 'FORBIDDEN')

  if (targetUserId === requesterId) {
    return errorResponse(c, 400, 'CANNOT_REMOVE_SELF')
  }

  const targetMember = await getMembership(campaignId, targetUserId)
  if (!targetMember) return errorResponse(c, 404, 'NOT_FOUND')

  await db
    .delete(campaignMembers)
    .where(
      and(
        eq(campaignMembers.campaignId, campaignId),
        eq(campaignMembers.userId, targetUserId)
      )
    )

  return c.body(null, 204)
})

export { router as campaignsRouter }
