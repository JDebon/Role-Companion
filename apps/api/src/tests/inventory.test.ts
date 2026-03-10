import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { computeCarryWeight, computeCarryCapacity } from '../routes/inventory.js'

beforeEach(clearDb)

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('computeCarryWeight', () => {
  it('returns 0 for empty inventory', () => {
    expect(computeCarryWeight([])).toBe(0)
  })

  it('sums weight × quantity', () => {
    const items = [
      { weight: 3, quantity: 1 },  // longsword 3 lb
      { weight: 0.1, quantity: 2 }, // small items
    ]
    expect(computeCarryWeight(items)).toBeCloseTo(3.2)
  })

  it('treats null weight as 0', () => {
    const items = [{ weight: null, quantity: 5 }]
    expect(computeCarryWeight(items)).toBe(0)
  })
})

describe('computeCarryCapacity', () => {
  it('returns STR × 15', () => {
    expect(computeCarryCapacity(10)).toBe(150)
    expect(computeCarryCapacity(17)).toBe(255)
    expect(computeCarryCapacity(1)).toBe(15)
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
  name: 'Thorin Ironbeard',
  className: 'Fighter',
  raceName: 'Dwarf',
  backgroundName: 'Soldier',
  level: 1,
  str: 17, dex: 12, con: 16, int: 10, wis: 13, cha: 8,
  maxHp: 13, currentHp: 13,
  armorClass: 18,
}

async function createCharacter(token: string, campaignId: string, overrides = {}): Promise<string> {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...defaultCharData, ...overrides }),
  })
  const body = await res.json() as { id: string }
  return body.id
}

// ── GET /characters/:id/inventory ─────────────────────────────────────────────

describe('GET /api/v1/characters/:id/inventory', () => {
  it('returns empty inventory for a new character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.items).toEqual([])
    expect(body.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
    expect(body.carryWeight).toBe(0)
    expect(body.carryCapacity).toBe(255) // STR 17 × 15
  })

  it('returns 404 for non-member', async () => {
    const token = await registerAndLogin()
    const otherToken = await registerAndLogin('other@test.com', 'password123', 'Other')
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(otherToken),
    })
    expect(res.status).toBe(404)
  })

  it('campaign member (not owner) can read inventory', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
  })
})

// ── POST /characters/:id/inventory ────────────────────────────────────────────

describe('POST /api/v1/characters/:id/inventory', () => {
  it('adds a SRD equipment item and auto-fills name and weight', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ srdEquipmentIndex: 'longsword', quantity: 1 }),
    })
    expect(res.status).toBe(201)
    const item = await res.json() as any
    expect(item.characterId).toBe(charId)
    expect(item.srdEquipmentIndex).toBe('longsword')

    // Verify GET returns the item with correct resolved data
    const getRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(token),
    })
    const body = await getRes.json() as any
    expect(body.items).toHaveLength(1)
    const inv = body.items[0]
    expect(inv.name).toBe('Longsword')
    expect(inv.source).toBe('srd_equipment')
    expect(inv.srdIndex).toBe('longsword')
    expect(inv.weight).toBe(3)
    expect(inv.cost).toBe('15 gp')
    expect(inv.carryWeight).toBeUndefined()
    expect(body.carryWeight).toBe(3)
  })

  it('adds a free-text custom item', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ customName: 'Mysterious Amulet', customWeight: 0.1, quantity: 1 }),
    })
    expect(res.status).toBe(201)

    const getRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(token),
    })
    const body = await getRes.json() as any
    expect(body.items).toHaveLength(1)
    expect(body.items[0].name).toBe('Mysterious Amulet')
    expect(body.items[0].source).toBe('custom')
    expect(body.items[0].srdIndex).toBeNull()
    expect(body.items[0].weight).toBeCloseTo(0.1)
    expect(body.carryWeight).toBeCloseTo(0.1)
  })

  it('returns 404 when SRD equipment index does not exist', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ srdEquipmentIndex: 'nonexistent-item-xyz', quantity: 1 }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error).toBe('ITEM_NOT_FOUND')
  })

  it('returns 400 when quantity < 1', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ customName: 'Sword', quantity: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when no item source provided', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ quantity: 1 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when non-owner tries to add item', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ customName: 'Sword', quantity: 1 }),
    })
    expect(res.status).toBe(403)
  })
})

// ── PATCH /characters/:id/inventory/:itemId ───────────────────────────────────

describe('PATCH /api/v1/characters/:id/inventory/:itemId', () => {
  it('updates quantity and notes', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ customName: 'Arrow', quantity: 20 }),
    })
    const { id: itemId } = await addRes.json() as any

    const patchRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ quantity: 15, notes: 'Used 5 in battle' }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as any
    expect(updated.quantity).toBe(15)
    expect(updated.notes).toBe('Used 5 in battle')
  })

  it('returns 400 when patching quantity to 0', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ customName: 'Sword', quantity: 1 }),
    })
    const { id: itemId } = await addRes.json() as any

    const patchRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ quantity: 0 }),
    })
    expect(patchRes.status).toBe(400)
  })

  it('can mark item as equipped', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ srdEquipmentIndex: 'longsword', quantity: 1 }),
    })
    const { id: itemId } = await addRes.json() as any

    const patchRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ isEquipped: true }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as any
    expect(updated.isEquipped).toBe(true)
  })

  it('returns 403 when non-owner tries to patch', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const charId = await createCharacter(dmToken, campaignId)
    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ customName: 'Sword', quantity: 1 }),
    })
    const { id: itemId } = await addRes.json() as any

    const patchRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'PATCH',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ isEquipped: true }),
    })
    expect(patchRes.status).toBe(403)
  })
})

// ── Attunement ────────────────────────────────────────────────────────────────

describe('Attunement limit', () => {
  it('can attune up to 3 items', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    // Add 3 items and attune them all
    for (let i = 1; i <= 3; i++) {
      const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ customName: `Magic Item ${i}`, quantity: 1 }),
      })
      const { id: itemId } = await addRes.json() as any
      const patchRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ isAttuned: true }),
      })
      expect(patchRes.status).toBe(200)
    }
  })

  it('returns 409 when trying to attune a 4th item', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const itemIds: string[] = []
    for (let i = 1; i <= 4; i++) {
      const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ customName: `Magic Item ${i}`, quantity: 1 }),
      })
      const { id } = await addRes.json() as any
      itemIds.push(id)
    }

    // Attune first 3
    for (let i = 0; i < 3; i++) {
      await app.request(`/api/v1/characters/${charId}/inventory/${itemIds[i]}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ isAttuned: true }),
      })
    }

    // Try to attune 4th
    const res = await app.request(`/api/v1/characters/${charId}/inventory/${itemIds[3]}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ isAttuned: true }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error).toBe('ATTUNEMENT_SLOTS_FULL')
  })

  it('can attune after un-attuning an item', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const itemIds: string[] = []
    for (let i = 1; i <= 4; i++) {
      const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ customName: `Magic Item ${i}`, quantity: 1 }),
      })
      const { id } = await addRes.json() as any
      itemIds.push(id)
    }

    // Attune first 3
    for (let i = 0; i < 3; i++) {
      await app.request(`/api/v1/characters/${charId}/inventory/${itemIds[i]}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ isAttuned: true }),
      })
    }

    // Un-attune the first
    await app.request(`/api/v1/characters/${charId}/inventory/${itemIds[0]}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ isAttuned: false }),
    })

    // Now attune the 4th — should succeed
    const res = await app.request(`/api/v1/characters/${charId}/inventory/${itemIds[3]}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ isAttuned: true }),
    })
    expect(res.status).toBe(200)
  })
})

// ── DELETE /characters/:id/inventory/:itemId ─────────────────────────────────

describe('DELETE /api/v1/characters/:id/inventory/:itemId', () => {
  it('owner can delete an item', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ customName: 'Sword', quantity: 1 }),
    })
    const { id: itemId } = await addRes.json() as any

    const delRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(delRes.status).toBe(204)

    const getRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(token),
    })
    const body = await getRes.json() as any
    expect(body.items).toHaveLength(0)
  })

  it('returns 403 when non-owner tries to delete', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const charId = await createCharacter(dmToken, campaignId)
    const addRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ customName: 'Sword', quantity: 1 }),
    })
    const { id: itemId } = await addRes.json() as any

    const delRes = await app.request(`/api/v1/characters/${charId}/inventory/${itemId}`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(delRes.status).toBe(403)
  })
})

// ── PUT /characters/:id/currency ─────────────────────────────────────────────

describe('PUT /api/v1/characters/:id/currency', () => {
  it('sets currency values', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ pp: 0, gp: 150, ep: 0, sp: 20, cp: 5 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.gp).toBe(150)
    expect(body.sp).toBe(20)
    expect(body.cp).toBe(5)
  })

  it('persists currency and appears in inventory GET', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ pp: 0, gp: 200, ep: 0, sp: 15, cp: 0 }),
    })

    const getRes = await app.request(`/api/v1/characters/${charId}/inventory`, {
      headers: authHeaders(token),
    })
    const body = await getRes.json() as any
    expect(body.currency.gp).toBe(200)
    expect(body.currency.sp).toBe(15)
  })

  it('overwrites previous currency values on second PUT', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 }),
    })
    const res = await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ pp: 5, gp: 50, ep: 0, sp: 30, cp: 10 }),
    })
    const body = await res.json() as any
    expect(body.pp).toBe(5)
    expect(body.gp).toBe(50)
    expect(body.sp).toBe(30)
  })

  it('returns 400 when currency value is negative', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ pp: 0, gp: -1, ep: 0, sp: 0, cp: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when non-owner tries to set currency', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const charId = await createCharacter(dmToken, campaignId)

    const res = await app.request(`/api/v1/characters/${charId}/currency`, {
      method: 'PUT',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 }),
    })
    expect(res.status).toBe(403)
  })
})
