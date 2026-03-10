import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { clampHp, advanceTurn, buildSortOrder } from '../routes/dm-tools.js'

beforeEach(clearDb)

// ── Unit tests ─────────────────────────────────────────────────────────────────

describe('clampHp', () => {
  it('applies damage reducing HP', () => {
    expect(clampHp(10, -7, 20)).toBe(3)
  })

  it('clamps damage at 0 (cannot go below 0)', () => {
    expect(clampHp(5, -10, 20)).toBe(0)
  })

  it('applies healing increasing HP', () => {
    expect(clampHp(10, 5, 20)).toBe(15)
  })

  it('clamps healing at max HP (cannot exceed max)', () => {
    expect(clampHp(18, 10, 20)).toBe(20)
  })

  it('returns 0 for exactly deadly damage', () => {
    expect(clampHp(7, -7, 20)).toBe(0)
  })
})

describe('advanceTurn', () => {
  it('advances to next combatant', () => {
    const combatants = [
      { isUnconscious: false },
      { isUnconscious: false },
      { isUnconscious: false },
    ]
    const { nextIndex, newRound } = advanceTurn(combatants, 0, 1)
    expect(nextIndex).toBe(1)
    expect(newRound).toBe(1)
  })

  it('wraps around and increments round', () => {
    const combatants = [
      { isUnconscious: false },
      { isUnconscious: false },
    ]
    const { nextIndex, newRound } = advanceTurn(combatants, 1, 1)
    expect(nextIndex).toBe(0)
    expect(newRound).toBe(2)
  })

  it('skips unconscious combatants', () => {
    const combatants = [
      { isUnconscious: false }, // 0
      { isUnconscious: true },  // 1 — unconscious
      { isUnconscious: false }, // 2
    ]
    const { nextIndex, newRound } = advanceTurn(combatants, 0, 1)
    expect(nextIndex).toBe(2)
    expect(newRound).toBe(1)
  })

  it('wraps and skips unconscious combatants', () => {
    const combatants = [
      { isUnconscious: false }, // 0
      { isUnconscious: false }, // 1
      { isUnconscious: true },  // 2 — unconscious
    ]
    const { nextIndex, newRound } = advanceTurn(combatants, 1, 1)
    // Should skip 2 (unconscious), wrap to 0 with round 2
    const result = advanceTurn(combatants, 1, 1)
    expect(result.nextIndex).toBe(0)
    expect(result.newRound).toBe(2)
  })

  it('returns same position when all unconscious', () => {
    const combatants = [
      { isUnconscious: true },
      { isUnconscious: true },
    ]
    const { nextIndex, newRound } = advanceTurn(combatants, 0, 3)
    expect(nextIndex).toBe(0)
    expect(newRound).toBe(3)
  })

  it('handles empty combatant list', () => {
    const { nextIndex, newRound } = advanceTurn([], 0, 1)
    expect(nextIndex).toBe(0)
    expect(newRound).toBe(1)
  })
})

describe('buildSortOrder', () => {
  it('sorts combatants descending by initiative', () => {
    const combatants = [
      { id: 'a', initiative: 10 },
      { id: 'b', initiative: 18 },
      { id: 'c', initiative: 5 },
    ]
    const result = buildSortOrder(combatants)
    const sorted = result.sort((a, b) => a.sortOrder - b.sortOrder)
    expect(sorted[0].id).toBe('b') // 18 — first
    expect(sorted[1].id).toBe('a') // 10 — second
    expect(sorted[2].id).toBe('c') // 5 — third
  })

  it('treats null initiative as 0', () => {
    const combatants = [
      { id: 'a', initiative: null },
      { id: 'b', initiative: 10 },
    ]
    const result = buildSortOrder(combatants)
    const sorted = result.sort((a, b) => a.sortOrder - b.sortOrder)
    expect(sorted[0].id).toBe('b')
    expect(sorted[1].id).toBe('a')
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

async function createCharacter(token: string, campaignId: string): Promise<string> {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: 'Thorin',
      className: 'Fighter',
      raceName: 'Dwarf',
      backgroundName: 'Soldier',
      level: 3,
      str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8,
      maxHp: 28, currentHp: 28, armorClass: 16, speed: 30,
    }),
  })
  const body = await res.json() as { id: string }
  return body.id
}

async function createEncounter(token: string, campaignId: string, name = 'Goblin Ambush'): Promise<string> {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })
  const body = await res.json() as { id: string }
  return body.id
}

async function addSrdMonster(
  token: string,
  campaignId: string,
  encId: string,
  monsterIndex: string,
  count = 1
) {
  return app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ type: 'srd_monster', monsterIndex, count }),
  })
}

// ── Encounter CRUD ────────────────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters', () => {
  it('DM can create an encounter', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Goblin Ambush' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; name: string; status: string; round: number }
    expect(body.name).toBe('Goblin Ambush')
    expect(body.status).toBe('preparing')
    expect(body.round).toBe(1)
    expect(body.id).toBeTruthy()
  })

  it('player cannot create encounter (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ name: 'Goblin Ambush' }),
    })
    expect(res.status).toBe(403)
  })

  it('non-member gets 404', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const outsider = await registerAndLogin('outsider@test.com')

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      headers: authHeaders(outsider),
      body: JSON.stringify({ name: 'Sneaky Encounter' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /campaigns/:id/encounters', () => {
  it('returns empty list initially', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('lists created encounters with combatantCount', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    await createEncounter(token, campaignId)
    await createEncounter(token, campaignId, 'Dragon Lair')

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as Array<{ name: string; combatantCount: number }>
    expect(body.length).toBe(2)
    expect(body.some(e => e.name === 'Goblin Ambush')).toBe(true)
    expect(body.some(e => e.name === 'Dragon Lair')).toBe(true)
    expect(body[0].combatantCount).toBe(0)
  })

  it('player cannot list encounters (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /campaigns/:id/encounters/:encId', () => {
  it('returns encounter with empty combatants', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { combatants: unknown[] }
    expect(body.combatants).toEqual([])
  })

  it('returns 404 for wrong campaign', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const { campaignId: otherCampaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${otherCampaignId}/encounters/${encId}`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /campaigns/:id/encounters/:encId', () => {
  it('DM can delete encounter', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(204)

    const list = await app.request(`/api/v1/campaigns/${campaignId}/encounters`, {
      headers: authHeaders(token),
    })
    const body = await list.json() as unknown[]
    expect(body.length).toBe(0)
  })
})

// ── Add combatants ─────────────────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters/:encId/combatants', () => {
  it('adds 3 SRD goblins with auto-numbering', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await addSrdMonster(token, campaignId, encId, 'goblin', 3)
    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ displayName: string; maxHp: number; armorClass: number }>
    expect(body.length).toBe(3)
    expect(body[0].displayName).toBe('Goblin 1')
    expect(body[1].displayName).toBe('Goblin 2')
    expect(body[2].displayName).toBe('Goblin 3')
    expect(body[0].maxHp).toBeGreaterThan(0)
    expect(body[0].armorClass).toBeGreaterThan(0)
  })

  it('single SRD monster without numbering', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    const body = await res.json() as Array<{ displayName: string }>
    expect(body[0].displayName).toBe('Goblin')
  })

  it('continues numbering when adding more of same monster', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    await addSrdMonster(token, campaignId, encId, 'goblin', 2)
    const res = await addSrdMonster(token, campaignId, encId, 'goblin', 2)
    const body = await res.json() as Array<{ displayName: string }>
    expect(body[0].displayName).toBe('Goblin 3')
    expect(body[1].displayName).toBe('Goblin 4')
  })

  it('adds a player character combatant', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)
    const charId = await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'player_character', characterId: charId }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ displayName: string; maxHp: number; armorClass: number }>
    expect(body[0].displayName).toBe('Thorin (PC)')
    expect(body[0].maxHp).toBe(28)
    expect(body[0].armorClass).toBe(16)
  })

  it('returns 404 for unknown SRD monster', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await addSrdMonster(token, campaignId, encId, 'nonexistent-monster-xyz', 1)
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('MONSTER_NOT_FOUND')
  })

  it('cannot add combatants after encounter starts (409)', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)
    const combRes = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    const [comb] = await combRes.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ initiatives: [{ combatantId: comb.id, initiative: 10 }] }),
    })

    const res = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('ENCOUNTER_ALREADY_STARTED')
  })
})

// ── Start encounter ───────────────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters/:encId/start', () => {
  it('sorts combatants by initiative descending', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const goblinRes = await addSrdMonster(token, campaignId, encId, 'goblin', 2)
    const [g1, g2] = await goblinRes.json() as Array<{ id: string }>
    const charId = await createCharacter(token, campaignId)
    const pcRes = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'player_character', characterId: charId }),
    })
    const [pc] = await pcRes.json() as Array<{ id: string }>

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        initiatives: [
          { combatantId: g1.id, initiative: 14 },
          { combatantId: g2.id, initiative: 8 },
          { combatantId: pc.id, initiative: 18 },
        ],
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      status: string;
      currentTurnIndex: number;
      combatants: Array<{ displayName: string; initiative: number }>
    }
    expect(body.status).toBe('active')
    expect(body.currentTurnIndex).toBe(0)
    // PC (18) should be first, Goblin 1 (14) second, Goblin 2 (8) third
    expect(body.combatants[0].displayName).toBe('Thorin (PC)')
    expect(body.combatants[0].initiative).toBe(18)
    expect(body.combatants[1].displayName).toBe('Goblin 1')
    expect(body.combatants[2].displayName).toBe('Goblin 2')
  })
})

// ── HP delta ──────────────────────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters/:encId/combatants/:combId/hp', () => {
  async function setupActiveEncounter(token: string, campaignId: string) {
    const encId = await createEncounter(token, campaignId)
    const combRes = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    const [comb] = await combRes.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ initiatives: [{ combatantId: comb.id, initiative: 10 }] }),
    })
    return { encId, combId: comb.id }
  }

  it('applies damage reducing HP', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const { encId, combId } = await setupActiveEncounter(token, campaignId)

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${combId}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: -3 }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { currentHp: number; isUnconscious: boolean }
    expect(body.currentHp).toBeLessThan(7)
    expect(body.isUnconscious).toBe(false)
  })

  it('marks combatant unconscious at 0 HP', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const { encId, combId } = await setupActiveEncounter(token, campaignId)

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${combId}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: -100 }) }
    )
    const body = await res.json() as { currentHp: number; isUnconscious: boolean }
    expect(body.currentHp).toBe(0)
    expect(body.isUnconscious).toBe(true)
  })

  it('clamps healing at max HP', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const { encId, combId } = await setupActiveEncounter(token, campaignId)

    // First damage a bit
    await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${combId}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: -3 }) }
    )
    // Then over-heal
    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${combId}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: 100 }) }
    )
    const body = await res.json() as { currentHp: number }
    // Goblin max HP is 7
    expect(body.currentHp).toBe(7)
  })
})

// ── Next turn ─────────────────────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters/:encId/next-turn', () => {
  it('advances turn to next combatant', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const r1 = await addSrdMonster(token, campaignId, encId, 'goblin', 2)
    const [g1, g2] = await r1.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        initiatives: [
          { combatantId: g1.id, initiative: 14 },
          { combatantId: g2.id, initiative: 8 },
        ],
      }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/next-turn`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { currentTurnIndex: number; round: number }
    expect(body.currentTurnIndex).toBe(1)
    expect(body.round).toBe(1)
  })

  it('wraps to next round', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const r1 = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    const [g1] = await r1.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ initiatives: [{ combatantId: g1.id, initiative: 10 }] }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/next-turn`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    const body = await res.json() as { currentTurnIndex: number; round: number }
    // Single combatant wraps to itself with round 2
    expect(body.round).toBe(2)
  })

  it('skips unconscious combatants', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const r1 = await addSrdMonster(token, campaignId, encId, 'goblin', 3)
    const [g1, g2, g3] = await r1.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        initiatives: [
          { combatantId: g1.id, initiative: 18 },
          { combatantId: g2.id, initiative: 14 },
          { combatantId: g3.id, initiative: 8 },
        ],
      }),
    })

    // Kill g2 (index 1 after sorting)
    await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${g2.id}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: -100 }) }
    )

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/next-turn`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    const body = await res.json() as { currentTurnIndex: number; activeCombatant: { id: string } }
    // Should skip unconscious g2 and land on g3
    expect(body.currentTurnIndex).toBe(2)
    expect(body.activeCombatant.id).toBe(g3.id)
  })
})

// ── End and reset encounter ───────────────────────────────────────────────────

describe('POST /campaigns/:id/encounters/:encId/end', () => {
  it('sets encounter status to completed', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/end`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('completed')
  })
})

describe('POST /campaigns/:id/encounters/:encId/reset', () => {
  it('restores HP and sets status to preparing', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    const combRes = await addSrdMonster(token, campaignId, encId, 'goblin', 1)
    const [comb] = await combRes.json() as Array<{ id: string }>

    await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/start`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ initiatives: [{ combatantId: comb.id, initiative: 10 }] }),
    })

    // Damage the goblin
    await app.request(
      `/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants/${comb.id}/hp`,
      { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ delta: -100 }) }
    )

    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/reset`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; round: number }
    expect(body.status).toBe('preparing')
    expect(body.round).toBe(1)

    // Verify combatant HP restored
    const encRes = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}`, {
      headers: authHeaders(token),
    })
    const encBody = await encRes.json() as { combatants: Array<{ currentHp: number; maxHp: number; isUnconscious: boolean }> }
    expect(encBody.combatants[0].currentHp).toBe(encBody.combatants[0].maxHp)
    expect(encBody.combatants[0].isUnconscious).toBe(false)
  })
})

// ── NPC management ────────────────────────────────────────────────────────────

describe('POST /campaigns/:id/npcs', () => {
  it('DM can create an NPC', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Mirtala the Innkeeper', monsterIndex: 'commoner', notes: 'Friendly innkeeper' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; name: string; monsterIndex: string }
    expect(body.name).toBe('Mirtala the Innkeeper')
    expect(body.monsterIndex).toBe('commoner')
    expect(body.id).toBeTruthy()
  })

  it('player cannot create NPC (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ name: 'Evil NPC' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /campaigns/:id/npcs', () => {
  it('members can list NPCs', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ name: 'Mirtala', monsterIndex: 'commoner' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ name: string }>
    expect(body.some(n => n.name === 'Mirtala')).toBe(true)
  })
})

describe('NPC as combatant', () => {
  it('NPC with SRD base — HP/AC pre-filled from commoner stat block', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)
    const encId = await createEncounter(token, campaignId)

    // Create NPC with commoner base
    const npcRes = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Mirtala', monsterIndex: 'commoner' }),
    })
    const npc = await npcRes.json() as { id: string }

    // Add NPC to encounter
    const res = await app.request(`/api/v1/campaigns/${campaignId}/encounters/${encId}/combatants`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'npc', npcId: npc.id }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ displayName: string; maxHp: number; armorClass: number }>
    expect(body[0].displayName).toBe('Mirtala')
    expect(body[0].maxHp).toBeGreaterThan(0)
    expect(body[0].armorClass).toBeGreaterThan(0)
  })
})

describe('PATCH /campaigns/:id/npcs/:npcId', () => {
  it('DM can update NPC', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Mirtala', monsterIndex: 'commoner' }),
    })
    const { id } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Mirtala the Elder', notes: 'Now very old' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { name: string; notes: string }
    expect(body.name).toBe('Mirtala the Elder')
    expect(body.notes).toBe('Now very old')
  })
})

describe('DELETE /campaigns/:id/npcs/:npcId', () => {
  it('DM can delete NPC', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Mirtala' }),
    })
    const { id } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(204)

    const listRes = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      headers: authHeaders(token),
    })
    const body = await listRes.json() as Array<{ id: string }>
    expect(body.some(n => n.id === id)).toBe(false)
  })

  it('player cannot delete NPC (403)', async () => {
    const dmToken = await registerAndLogin()
    const { campaignId, inviteCode } = await createCampaign(dmToken)
    const playerToken = await registerAndLogin('player@test.com')
    await joinCampaign(playerToken, inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaignId}/npcs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ name: 'Mirtala' }),
    })
    const { id } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaignId}/npcs/${id}`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent NPC', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaign(token)

    const res = await app.request(
      `/api/v1/campaigns/${campaignId}/npcs/00000000-0000-0000-0000-000000000000`,
      { method: 'DELETE', headers: authHeaders(token) }
    )
    expect(res.status).toBe(404)
  })
})
