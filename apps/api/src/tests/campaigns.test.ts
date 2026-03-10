import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'

beforeEach(clearDb)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndLogin(
  email = 'user@test.com',
  password = 'password123',
  displayName = 'Tester'
): Promise<string> {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  })
  const { token } = await res.json()
  return token as string
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function createCampaign(token: string, name = 'Test Campaign') {
  const res = await app.request('/api/v1/campaigns', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })
  return res.json() as Promise<{ id: string; inviteCode: string; role: string }>
}

// ── Create campaign ──────────────────────────────────────────────────────────

describe('POST /api/v1/campaigns', () => {
  it('creates a campaign and assigns DM role', async () => {
    const token = await registerAndLogin()
    const res = await app.request('/api/v1/campaigns', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Lost Mines' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.role).toBe('dungeon_master')
    expect(body.inviteCode).toHaveLength(8)
  })

  it('returns 400 if name exceeds 100 chars', async () => {
    const token = await registerAndLogin()
    const res = await app.request('/api/v1/campaigns', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'A'.repeat(101) }),
    })
    expect(res.status).toBe(400)
  })
})

// ── Join campaign ────────────────────────────────────────────────────────────

describe('POST /api/v1/campaigns/join', () => {
  it('joins a campaign as player with a valid invite code', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')

    const { inviteCode } = await createCampaign(dmToken)

    const res = await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('player')
  })

  it('returns 409 if already a member', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const { inviteCode } = await createCampaign(dmToken)

    const res = await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ inviteCode }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('ALREADY_MEMBER')
  })

  it('returns 400 for an invalid invite code', async () => {
    const token = await registerAndLogin()
    const res = await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ inviteCode: 'XXXXXXXX' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('INVALID_INVITE_CODE')
  })
})

// ── Remove member ────────────────────────────────────────────────────────────

describe('DELETE /api/v1/campaigns/:id/members/:userId', () => {
  it('DM can remove a player', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')

    const { id: campaignId, inviteCode } = await createCampaign(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const playerRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player@test.com', password: 'password123' }),
    })
    const { user: playerUser } = await playerRes.json()

    const removeRes = await app.request(
      `/api/v1/campaigns/${campaignId}/members/${playerUser.id}`,
      { method: 'DELETE', headers: authHeaders(dmToken) }
    )
    expect(removeRes.status).toBe(204)
  })

  it('returns 403 when a player tries to remove a member', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const p1Token = await registerAndLogin('p1@test.com', 'password123', 'P1')
    const p2Token = await registerAndLogin('p2@test.com', 'password123', 'P2')

    const { id: campaignId, inviteCode } = await createCampaign(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(p1Token),
      body: JSON.stringify({ inviteCode }),
    })
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(p2Token),
      body: JSON.stringify({ inviteCode }),
    })

    const p2Login = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'p2@test.com', password: 'password123' }),
    })
    const { user: p2User } = await p2Login.json()

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/members/${p2User.id}`,
      { method: 'DELETE', headers: authHeaders(p1Token) }
    )
    expect(res.status).toBe(403)
  })

  it('DM cannot remove themselves', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const { id: campaignId } = await createCampaign(dmToken)

    const dmLogin = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dm@test.com', password: 'password123' }),
    })
    const { user: dmUser } = await dmLogin.json()

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/members/${dmUser.id}`,
      { method: 'DELETE', headers: authHeaders(dmToken) }
    )
    expect(res.status).toBe(400)
  })
})

// ── Invite code regeneration ─────────────────────────────────────────────────

describe('POST /api/v1/campaigns/:id/invite/regenerate', () => {
  it('generates a new invite code and invalidates the old one', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const { id: campaignId, inviteCode: oldCode } = await createCampaign(dmToken)

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/invite/regenerate`,
      { method: 'POST', headers: authHeaders(dmToken) }
    )
    expect(res.status).toBe(200)
    const { inviteCode: newCode } = await res.json()
    expect(newCode).toHaveLength(8)
    expect(newCode).not.toBe(oldCode)

    // old code should no longer work
    const joinRes = await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ inviteCode: oldCode }),
    })
    expect(joinRes.status).toBe(400)
  })
})
