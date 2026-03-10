import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { validateEntityData, deepMerge } from '../routes/custom-content.js'

beforeEach(clearDb)

// ── Unit tests ─────────────────────────────────────────────────────────────────

describe('validateEntityData', () => {
  it('accepts valid monster data', () => {
    const result = validateEntityData('monster', {
      name: 'Cave Troll',
      hit_points: 84,
      armor_class: [{ value: 15, type: 'natural' }],
      challenge_rating: 5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects monster missing hit_points', () => {
    const result = validateEntityData('monster', {
      name: 'Cave Troll',
      armor_class: [{ value: 15 }],
      challenge_rating: 5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects monster with empty armor_class array', () => {
    const result = validateEntityData('monster', {
      name: 'Cave Troll',
      hit_points: 84,
      armor_class: [],
      challenge_rating: 5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid item data', () => {
    const result = validateEntityData('item', {
      name: 'Sword of Starlight',
      equipment_category: 'Weapon',
    })
    expect(result.success).toBe(true)
  })

  it('rejects item missing equipment_category', () => {
    const result = validateEntityData('item', { name: 'Sword' })
    expect(result.success).toBe(false)
  })

  it('accepts valid rule data', () => {
    const result = validateEntityData('rule', {
      name: 'Critical Fumble',
      desc: 'On a natural 1, roll on the fumble table.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects rule missing desc', () => {
    const result = validateEntityData('rule', { name: 'Critical Fumble' })
    expect(result.success).toBe(false)
  })
})

describe('deepMerge', () => {
  it('applies scalar overrides over base', () => {
    const base = { name: 'Goblin', hit_points: 7, challenge_rating: 0.25 }
    const overrides = { hit_points: 10 }
    const result = deepMerge(base, overrides)
    expect(result.hit_points).toBe(10)
    expect(result.name).toBe('Goblin')
    expect(result.challenge_rating).toBe(0.25)
  })

  it('replaces arrays entirely', () => {
    const base = { actions: [{ name: 'Claw' }] }
    const overrides = { actions: [{ name: 'Bite' }, { name: 'Claw' }] }
    const result = deepMerge(base, overrides)
    expect(result.actions).toEqual([{ name: 'Bite' }, { name: 'Claw' }])
  })

  it('deeply merges nested objects', () => {
    const base = { speed: { walk: '30 ft.', swim: '10 ft.' } }
    const overrides = { speed: { walk: '40 ft.' } }
    const result = deepMerge(base, overrides)
    expect((result.speed as Record<string, unknown>).walk).toBe('40 ft.')
    expect((result.speed as Record<string, unknown>).swim).toBe('10 ft.')
  })
})

// ── Integration helpers ────────────────────────────────────────────────────────

async function registerAndLogin(
  email = 'dm@test.com',
  password = 'password123',
  displayName = 'Dungeon Master'
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

async function createCampaign(token: string): Promise<{ campaignId: string; inviteCode: string }> {
  const res = await app.request('/api/v1/campaigns', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name: 'Test Campaign' }),
  })
  const body = await res.json() as { id: string; inviteCode: string }
  return { campaignId: body.id, inviteCode: body.inviteCode }
}

async function joinCampaign(token: string, inviteCode: string): Promise<void> {
  await app.request('/api/v1/campaigns/join', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ inviteCode }),
  })
}

const validMonsterBody = {
  entityType: 'monster',
  name: 'Cave Troll',
  baseIndex: null,
  data: {
    hit_points: 84,
    armor_class: [{ value: 15, type: 'natural' }],
    challenge_rating: 5,
    size: 'Large',
    type: 'giant',
  },
}

const validItemBody = {
  entityType: 'item',
  name: 'Sword of Starlight',
  baseIndex: null,
  data: {
    equipment_category: 'Weapon',
    rarity: 'rare',
    requires_attunement: true,
    desc: 'A blade that glows with starlight.',
  },
}

const validRuleBody = {
  entityType: 'rule',
  name: 'Critical Fumble',
  data: {
    desc: 'On a natural 1, roll on the fumble table.',
  },
}

// ── Integration tests ──────────────────────────────────────────────────────────

describe('GET /campaigns/:id/custom-content', () => {
  it('returns empty list when no custom content', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 404 for non-member', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId } = await createCampaign(dmToken)
    const outsiderToken = await registerAndLogin('outsider@test.com')

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      headers: authHeaders(outsiderToken),
    })
    expect(res.status).toBe(404)
  })

  it('requires auth', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`)
    expect(res.status).toBe(401)
  })
})

describe('POST /campaigns/:id/custom-content', () => {
  it('DM creates a monster from scratch', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; entityType: string; name: string }
    expect(body.entityType).toBe('monster')
    expect(body.name).toBe('Cave Troll')
    expect(body.id).toBeTruthy()
  })

  it('DM creates an item from scratch', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validItemBody),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { entityType: string; name: string }
    expect(body.entityType).toBe('item')
    expect(body.name).toBe('Sword of Starlight')
  })

  it('DM creates a rule entry', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validRuleBody),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { entityType: string; name: string }
    expect(body.entityType).toBe('rule')
    expect(body.name).toBe('Critical Fumble')
  })

  it('player cannot create custom content (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify(validMonsterBody),
    })
    expect(res.status).toBe(403)
  })

  it('non-member gets 404', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId } = await createCampaign(dmToken)
    const outsiderToken = await registerAndLogin('outsider@test.com')

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(outsiderToken),
      body: JSON.stringify(validMonsterBody),
    })
    expect(res.status).toBe(404)
  })

  it('rejects invalid monster data (400)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        entityType: 'monster',
        name: 'Bad Monster',
        data: { size: 'Large' }, // missing hit_points, armor_class, challenge_rating
      }),
    })
    expect(res.status).toBe(400)
  })

  it('created monster appears in GET list', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })

    const listRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      headers: authHeaders(token),
    })
    const list = await listRes.json() as Array<{ name: string }>
    expect(list.some(e => e.name === 'Cave Troll')).toBe(true)
  })

  it('player can read custom content created by DM', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify(validMonsterBody),
    })

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const list = await res.json() as Array<{ name: string }>
    expect(list.some(e => e.name === 'Cave Troll')).toBe(true)
  })
})

describe('GET /campaigns/:id/custom-content — type filter', () => {
  it('filters by ?type=monster', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validItemBody),
    })

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content?type=monster`,
      { headers: authHeaders(token) }
    )
    const list = await res.json() as Array<{ entityType: string }>
    expect(list.every(e => e.entityType === 'monster')).toBe(true)
    expect(list.length).toBe(1)
  })
})

describe('GET /campaigns/:id/custom-content/:entityId', () => {
  it('returns full entity data', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${created.id}`,
      { headers: authHeaders(token) }
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { data: Record<string, unknown>; name: string }
    expect(body.name).toBe('Cave Troll')
    expect(body.data).toBeTruthy()
  })

  it('returns 404 for wrong campaign', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const { campaignId: otherCampaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${otherCampaignId}/custom-content/${created.id}`,
      { headers: authHeaders(token) }
    )
    expect(res.status).toBe(404)
  })
})

describe('SRD clone (baseIndex)', () => {
  it('returns 404 when base SRD index not found', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        entityType: 'monster',
        name: 'My Custom Goblin',
        baseIndex: 'nonexistent-monster-index',
        data: { hit_points: 10, armor_class: [{ value: 12 }], challenge_rating: 0.25 },
      }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('BASE_NOT_FOUND')
  })

  it('clones SRD goblin and overrides HP', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        entityType: 'monster',
        name: 'Mighty Goblin',
        baseIndex: 'goblin',
        data: { hit_points: 20, armor_class: [{ value: 15, type: 'natural' }], challenge_rating: 0.25 },
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; baseIndex: string }
    expect(body.baseIndex).toBe('goblin')

    // Verify data: check HP overridden in detail endpoint
    const detailRes = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${body.id}`,
      { headers: authHeaders(token) }
    )
    const detail = await detailRes.json() as { data: Record<string, unknown> }
    expect(detail.data.hit_points).toBe(20)
    // Should still have other goblin fields (name from original)
    expect(detail.data.name).toBeTruthy()
  })

  it('does not allow baseIndex for rule type', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        entityType: 'rule',
        name: 'House Rule',
        baseIndex: 'goblin',
        data: { desc: 'test' },
      }),
    })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /campaigns/:id/custom-content/:entityId', () => {
  it('DM can update name and data', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${created.id}`,
      {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ name: 'Cave Troll (Veteran)', data: { hit_points: 100 } }),
      }
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { name: string; data: Record<string, unknown> }
    expect(body.name).toBe('Cave Troll (Veteran)')
    expect(body.data.hit_points).toBe(100)
  })

  it('player cannot patch (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${created.id}`,
      {
        method: 'PATCH',
        headers: authHeaders(playerToken),
        body: JSON.stringify({ name: 'Hacked Troll' }),
      }
    )
    expect(res.status).toBe(403)
  })
})

describe('DELETE /campaigns/:id/custom-content/:entityId', () => {
  it('DM can delete entity (204)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${created.id}`,
      { method: 'DELETE', headers: authHeaders(token) }
    )
    expect(res.status).toBe(204)

    // Verify gone from list
    const listRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      headers: authHeaders(token),
    })
    const list = await listRes.json() as Array<{ id: string }>
    expect(list.some(e => e.id === created.id)).toBe(false)
  })

  it('player cannot delete (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/custom-content`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify(validMonsterBody),
    })
    const created = await createRes.json() as { id: string }

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/${created.id}`,
      { method: 'DELETE', headers: authHeaders(playerToken) }
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent entity', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/custom-content/00000000-0000-0000-0000-000000000000`,
      { method: 'DELETE', headers: authHeaders(token) }
    )
    expect(res.status).toBe(404)
  })
})
