import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users } from '@rolecompanion/db'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
import { errorResponse } from '../lib/errors.js'

const router = new Hono()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, displayName } = c.req.valid('json')

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing.length > 0) {
    return errorResponse(c, 409, 'EMAIL_TAKEN')
  }

  const passwordHash = await hashPassword(password)

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName })
    .returning({ id: users.id, email: users.email, displayName: users.displayName })

  const token = signToken({ sub: user.id, email: user.email, displayName: user.displayName })

  return c.json({ token, user }, 201)
})

router.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  // Use a constant-time check: compare even if user not found (dummy hash)
  const DUMMY_HASH = '$2a$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn'
  const hash = user?.passwordHash ?? DUMMY_HASH
  const valid = await verifyPassword(password, hash)

  if (!user || !valid) {
    return errorResponse(c, 401, 'INVALID_CREDENTIALS')
  }

  const token = signToken({ sub: user.id, email: user.email, displayName: user.displayName })

  return c.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } })
})

export { router as authRouter }
