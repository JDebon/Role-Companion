import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { formatSlots, canExpendSlot, applyLongRest } from '../routes/spells.js'

beforeEach(clearDb)

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('formatSlots', () => {
  it('returns structured slots object', () => {
    const row = {
      l1Total: 4, l1Used: 1,
      l2Total: 3, l2Used: 0,
      l3Total: 0, l3Used: 0,
      l4Total: 0, l4Used: 0,
      l5Total: 0, l5Used: 0,
      l6Total: 0, l6Used: 0,
      l7Total: 0, l7Used: 0,
      l8Total: 0, l8Used: 0,
      l9Total: 0, l9Used: 0,
    }
    const result = formatSlots(row)
    expect(result.l1).toEqual({ total: 4, used: 1 })
    expect(result.l2).toEqual({ total: 3, used: 0 })
    expect(result.l9).toEqual({ total: 0, used: 0 })
  })
})

describe('canExpendSlot', () => {
  it('returns true when used < total', () => {
    expect(canExpendSlot(4, 1)).toBe(true)
    expect(canExpendSlot(1, 0)).toBe(true)
  })

  it('returns false when used >= total', () => {
    expect(canExpendSlot(2, 2)).toBe(false)
    expect(canExpendSlot(0, 0)).toBe(false)
    expect(canExpendSlot(3, 4)).toBe(false)
  })
})

describe('applyLongRest', () => {
  it('resets all used counts to 0', () => {
    const slots = formatSlots({
      l1Total: 4, l1Used: 4,
      l2Total: 3, l2Used: 2,
      l3Total: 2, l3Used: 1,
      l4Total: 0, l4Used: 0,
      l5Total: 0, l5Used: 0,
      l6Total: 0, l6Used: 0,
      l7Total: 0, l7Used: 0,
      l8Total: 0, l8Used: 0,
      l9Total: 0, l9Used: 0,
    })
    const result = applyLongRest(slots)
    expect(result.l1.used).toBe(0)
    expect(result.l2.used).toBe(0)
    expect(result.l3.used).toBe(0)
    // Totals unchanged
    expect(result.l1.total).toBe(4)
    expect(result.l2.total).toBe(3)
  })
})

// ── Integration helpers ───────────────────────────────────────────────────────

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

async function createCampaignAndGetId(token: string): Promise<{ campaignId: string; inviteCode: string }> {
  const res = await app.request('/api/v1/campaigns', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name: 'Test Campaign' }),
  })
  const body = await res.json() as { id: string; inviteCode: string }
  return { campaignId: body.id, inviteCode: body.inviteCode }
}

const defaultCharData = {
  name: 'Gandalf Grey',
  className: 'Wizard',
  raceName: 'Human',
  backgroundName: 'Sage',
  level: 5,
  str: 10, dex: 14, con: 12, int: 20, wis: 16, cha: 14,
  maxHp: 38, currentHp: 38,
  armorClass: 12,
}

async function createCharacter(token: string, campaignId: string): Promise<string> {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(defaultCharData),
  })
  const body = await res.json() as { id: string }
  return body.id
}

// ── GET /characters/:id/spells ─────────────────────────────────────────────────

describe('GET /api/v1/characters/:id/spells', () => {
  it('returns empty spells response for new character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.spells).toEqual([])
    expect(body.concentration).toBeNull()
    expect(body.slots.l1).toEqual({ total: 0, used: 0 })
    expect(body.slots.l9).toEqual({ total: 0, used: 0 })
  })

  it('returns 404 for non-member', async () => {
    const token = await registerAndLogin()
    const otherToken = await registerAndLogin('other@test.com', 'password123', 'Other')
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(otherToken),
    })
    expect(res.status).toBe(404)
  })

  it('campaign member (not owner) can read spells', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
  })
})

// ── POST /characters/:id/spells ────────────────────────────────────────────────

describe('POST /api/v1/characters/:id/spells', () => {
  it('adds a SRD spell to the character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.spellIndex).toBe('fireball')
    expect(body.name).toBe('Fireball')
    expect(body.level).toBe(3)
    expect(body.school).toBeTruthy()
    expect(body.status).toBe('known')
  })

  it('spell appears in GET /spells after adding', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as any
    expect(body.spells).toHaveLength(1)
    expect(body.spells[0].spellIndex).toBe('fireball')
    expect(body.spells[0].name).toBe('Fireball')
    expect(body.spells[0].level).toBe(3)
  })

  it('returns 409 when adding duplicate spell', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'prepared' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error).toBe('ALREADY_KNOWN')
  })

  it('returns 404 when spell index does not exist in SRD', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'nonexistent-spell-xyz', status: 'known' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error).toBe('SPELL_NOT_FOUND')
  })

  it('returns 403 when non-owner tries to add spell', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })
    expect(res.status).toBe(403)
  })

  it('adds a cantrip (level 0 spell)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fire-bolt', status: 'known' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.level).toBe(0)
  })
})

// ── DELETE /characters/:id/spells/:spellIndex ─────────────────────────────────

describe('DELETE /api/v1/characters/:id/spells/:spellIndex', () => {
  it('removes a spell from the character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })

    const delRes = await app.request(`/api/v1/characters/${charId}/spells/fireball`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(delRes.status).toBe(204)

    const getRes = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const body = await getRes.json() as any
    expect(body.spells).toHaveLength(0)
  })

  it('returns 404 when spell is not on character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spells/fireball`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when non-owner tries to remove spell', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    const charId = await createCharacter(dmToken, campaignId)
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells/fireball`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })
})

// ── PUT /characters/:id/spell-slots ───────────────────────────────────────────

describe('PUT /api/v1/characters/:id/spell-slots', () => {
  it('sets total slots for given levels', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ l1Total: 4, l2Total: 3, l3Total: 2 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.l1).toEqual({ total: 4, used: 0 })
    expect(body.l2).toEqual({ total: 3, used: 0 })
    expect(body.l3).toEqual({ total: 2, used: 0 })
    expect(body.l4).toEqual({ total: 0, used: 0 })
  })

  it('reflects in GET /spells response', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ l3Total: 4 }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as any
    expect(body.slots.l3).toEqual({ total: 4, used: 0 })
  })

  it('returns 403 when non-owner tries to set slots', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ l1Total: 4 }),
    })
    expect(res.status).toBe(403)
  })
})

// ── POST /characters/:id/spell-slots/expend ───────────────────────────────────

describe('POST /api/v1/characters/:id/spell-slots/expend', () => {
  it('expends a spell slot and increments used count', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ l3Total: 3 }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 3 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.l3).toEqual({ total: 3, used: 1 })
  })

  it('returns 400 when no slots remaining', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ l2Total: 2 }),
    })

    // Expend both slots
    await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 2 }),
    })
    await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 2 }),
    })

    // Try a 3rd
    const res = await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 2 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('INSUFFICIENT_SLOTS')
  })

  it('returns 400 when no slots configured (total = 0)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 5 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('INSUFFICIENT_SLOTS')
  })

  it('returns 400 when level is out of range', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 10 }),
    })
    expect(res.status).toBe(400)
  })
})

// ── POST /characters/:id/spell-slots/recover ──────────────────────────────────

describe('POST /api/v1/characters/:id/spell-slots/recover', () => {
  it('resets all used slots to 0 (long rest)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spell-slots`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ l1Total: 4, l2Total: 3 }),
    })

    // Expend some slots
    await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 1 }),
    })
    await app.request(`/api/v1/characters/${charId}/spell-slots/expend`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ level: 2 }),
    })

    // Long rest
    const res = await app.request(`/api/v1/characters/${charId}/spell-slots/recover`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'long' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.l1).toEqual({ total: 4, used: 0 })
    expect(body.l2).toEqual({ total: 3, used: 0 })
  })
})

// ── PUT /characters/:id/concentration ─────────────────────────────────────────

describe('PUT /api/v1/characters/:id/concentration', () => {
  it('sets concentration on a concentration spell on character list', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    // Add hold-person (concentration spell)
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person', status: 'prepared' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.spellIndex).toBe('hold-person')
    expect(body.name).toBeTruthy()
    expect(body.startedAt).toBeTruthy()
  })

  it('GET /spells shows active concentration', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person', status: 'prepared' }),
    })
    await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as any
    expect(body.concentration).not.toBeNull()
    expect(body.concentration.spellIndex).toBe('hold-person')
  })

  it('starting new concentration drops previous spell', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    // Add two concentration spells
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person', status: 'prepared' }),
    })
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'bless', status: 'prepared' }),
    })

    // Start first
    await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })

    // Start second — should replace first
    await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'bless' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as any
    expect(body.concentration.spellIndex).toBe('bless')
  })

  it('ends concentration when spellIndex is null', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person', status: 'prepared' }),
    })
    await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: null }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.spellIndex).toBeNull()

    const getRes = await app.request(`/api/v1/characters/${charId}/spells`, {
      headers: authHeaders(token),
    })
    const getBody = await getRes.json() as any
    expect(getBody.concentration).toBeNull()
  })

  it('returns 404 when spell is not on character list', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error).toBe('SPELL_NOT_FOUND')
  })

  it('returns 400 when spell is not a concentration spell', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    // fireball is not concentration
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball', status: 'known' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ spellIndex: 'fireball' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error).toBe('NOT_CONCENTRATION_SPELL')
  })

  it('returns 403 when non-owner tries to set concentration', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })
    const charId = await createCharacter(dmToken, campaignId)
    await app.request(`/api/v1/characters/${charId}/spells`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ spellIndex: 'hold-person', status: 'prepared' }),
    })

    const res = await app.request(`/api/v1/characters/${charId}/concentration`, {
      method: 'PUT',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ spellIndex: 'hold-person' }),
    })
    expect(res.status).toBe(403)
  })
})
