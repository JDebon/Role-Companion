import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signToken, verifyToken } from '../lib/jwt.js'
import { generateInviteCode } from '../lib/invite.js'

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('produces a hash that verifies correctly', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('signToken / verifyToken', () => {
  it('round-trips payload correctly', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', displayName: 'A' }
    const token = signToken(payload)
    const decoded = verifyToken(token)
    expect(decoded.sub).toBe(payload.sub)
    expect(decoded.email).toBe(payload.email)
    expect(decoded.displayName).toBe(payload.displayName)
  })

  it('rejects a tampered token', () => {
    const token = signToken({ sub: 'u', email: 'x@x.com', displayName: 'X' })
    expect(() => verifyToken(token + 'tamper')).toThrow()
  })
})

describe('generateInviteCode', () => {
  it('returns an 8-character alphanumeric string', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('produces unique codes across calls', () => {
    const codes = new Set(Array.from({ length: 100 }, generateInviteCode))
    expect(codes.size).toBeGreaterThan(90)
  })
})

// ── Integration tests ────────────────────────────────────────────────────────

beforeEach(clearDb)

async function register(
  email = 'user@test.com',
  password = 'password123',
  displayName = 'Tester'
) {
  return app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  })
}

describe('POST /api/v1/auth/register', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await register()
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.email).toBe('user@test.com')
  })

  it('returns 409 on duplicate email', async () => {
    await register()
    const res = await register()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('EMAIL_TAKEN')
  })

  it('returns 400 on password shorter than 8 chars', async () => {
    const res = await register('x@x.com', 'short')
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns a JWT on valid credentials', async () => {
    await register()
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTruthy()
  })

  it('returns 401 on wrong password (no hint)', async () => {
    await register()
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpassword' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 on unknown email (same error as wrong password)', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('Protected endpoints without JWT', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/api/v1/campaigns')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHORIZED')
  })
})
