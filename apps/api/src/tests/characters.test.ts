import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'
import { abilityMod, proficiencyBonus, skillBonus, defaultSkillProficiencies, defaultSavingThrowProficiencies } from '../lib/character-utils.js'

beforeEach(clearDb)

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('abilityMod', () => {
  it('returns 0 for score 10', () => expect(abilityMod(10)).toBe(0))
  it('returns 3 for score 16', () => expect(abilityMod(16)).toBe(3))
  it('returns -1 for score 8', () => expect(abilityMod(8)).toBe(-1))
  it('returns -5 for score 1', () => expect(abilityMod(1)).toBe(-5))
  it('returns 10 for score 30', () => expect(abilityMod(30)).toBe(10))
})

describe('proficiencyBonus', () => {
  it('returns 2 for level 1', () => expect(proficiencyBonus(1)).toBe(2))
  it('returns 2 for level 4', () => expect(proficiencyBonus(4)).toBe(2))
  it('returns 3 for level 5', () => expect(proficiencyBonus(5)).toBe(3))
  it('returns 4 for level 9', () => expect(proficiencyBonus(9)).toBe(4))
  it('returns 5 for level 13', () => expect(proficiencyBonus(13)).toBe(5))
  it('returns 6 for level 17', () => expect(proficiencyBonus(17)).toBe(6))
  it('returns 6 for level 20', () => expect(proficiencyBonus(20)).toBe(6))
})

describe('skillBonus', () => {
  const baseChar = {
    level: 1,
    str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10,
    skillProficiencies: defaultSkillProficiencies(),
    savingThrowProficiencies: defaultSavingThrowProficiencies(),
  }

  it('returns just modifier for non-proficient skill', () => {
    expect(skillBonus('acrobatics', baseChar)).toBe(2) // DEX 14 → mod +2
  })

  it('adds proficiency bonus for proficient skill', () => {
    const char = { ...baseChar, level: 5, skillProficiencies: { ...defaultSkillProficiencies(), acrobatics: 'proficient' as const } }
    expect(skillBonus('acrobatics', char)).toBe(5) // mod +2 + pb 3
  })

  it('adds double proficiency for expertise', () => {
    const char = { ...baseChar, level: 5, skillProficiencies: { ...defaultSkillProficiencies(), acrobatics: 'expertise' as const } }
    expect(skillBonus('acrobatics', char)).toBe(8) // mod +2 + pb*2 6
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
  maxHp: 13, currentHp: 13, temporaryHp: 0,
  armorClass: 18, speed: 25,
}

async function createCharacter(token: string, campaignId: string, overrides = {}) {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...defaultCharData, ...overrides }),
  })
  return res
}

// ── POST /campaigns/:id/characters ──────────────────────────────────────────

describe('POST /api/v1/campaigns/:id/characters', () => {
  it('creates a character and returns full sheet with derived values', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId)

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Thorin Ironbeard')
    expect(body.proficiencyBonus).toBe(2)
    expect(body.abilityScores.str.modifier).toBe(3)  // STR 17 → +3
    expect(body.abilityScores.cha.modifier).toBe(-1) // CHA 8 → -1
    expect(body.hp.current).toBe(13)
    expect(body.hp.max).toBe(13)
    expect(body.skills).toBeDefined()
    expect(body.savingThrows).toBeDefined()
  })

  it('initializes skill proficiencies with all skills set to none', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId)
    const body = await res.json() as any
    expect(body.skills.acrobatics.proficiency).toBe('none')
    expect(body.skills.athletics.proficiency).toBe('none')
    expect(Object.keys(body.skills)).toHaveLength(18)
  })

  it('accepts custom skill proficiencies', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId, {
      skillProficiencies: { athletics: 'proficient', acrobatics: 'expertise' },
    })
    const body = await res.json() as any
    expect(body.skills.athletics.proficiency).toBe('proficient')
    expect(body.skills.acrobatics.proficiency).toBe('expertise')
    expect(body.skills.history.proficiency).toBe('none') // unspecified → none
  })

  it('returns 400 when currentHp exceeds maxHp', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId, { currentHp: 20, maxHp: 10 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when ability score out of range', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId, { str: 31 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when level out of range', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const res = await createCharacter(token, campaignId, { level: 21 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when user is not a campaign member', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const otherToken = await registerAndLogin('other@test.com', 'password123', 'Other')
    const { campaignId } = await createCampaignAndGetId(dmToken)
    const res = await createCharacter(otherToken, campaignId)
    expect(res.status).toBe(404)
  })
})

// ── GET /campaigns/:id/characters ────────────────────────────────────────────

describe('GET /api/v1/campaigns/:id/characters', () => {
  it('returns character list for campaign member', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    await createCharacter(token, campaignId)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Thorin Ironbeard')
    expect(body[0].level).toBe(1)
    expect(body[0].currentHp).toBe(13)
  })

  it('returns 404 for non-member', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const otherToken = await registerAndLogin('other@test.com', 'password123', 'Other')
    const { campaignId } = await createCampaignAndGetId(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
      headers: authHeaders(otherToken),
    })
    expect(res.status).toBe(404)
  })
})

// ── GET /characters/:id ──────────────────────────────────────────────────────

describe('GET /api/v1/characters/:id', () => {
  it('returns full sheet with derived values', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.proficiencyBonus).toBe(2)
    expect(body.abilityScores.str.score).toBe(17)
    expect(body.abilityScores.str.modifier).toBe(3)
    expect(body.hp.current).toBe(13)
    expect(body.hp.max).toBe(13)
  })

  it('level 5 DEX 14 Acrobatics proficient → bonus +5', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId, {
      level: 5,
      dex: 14,
      skillProficiencies: { acrobatics: 'proficient' },
    })
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      headers: authHeaders(token),
    })
    const body = await res.json() as any
    expect(body.skills.acrobatics.bonus).toBe(5) // mod +2 + pb +3 = 5
  })

  it('DM can read any character in the campaign', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const createRes = await createCharacter(playerToken, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-member', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const otherToken = await registerAndLogin('other@test.com', 'password123', 'Other')
    const { campaignId } = await createCampaignAndGetId(dmToken)
    const createRes = await createCharacter(dmToken, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      headers: authHeaders(otherToken),
    })
    expect(res.status).toBe(404)
  })
})

// ── PATCH /characters/:id ────────────────────────────────────────────────────

describe('PATCH /api/v1/characters/:id', () => {
  it('updates currentHp and returns updated sheet', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId, { maxHp: 28, currentHp: 28 })
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ currentHp: 22 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.hp.current).toBe(22)
    expect(body.hp.max).toBe(28)
  })

  it('returns 400 when patched currentHp exceeds maxHp', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId, { maxHp: 28, currentHp: 15 })
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ currentHp: 30 }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when another player tries to patch', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const createRes = await createCharacter(dmToken, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'PATCH',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ currentHp: 5 }),
    })
    expect(res.status).toBe(403)
  })

  it('merges skill proficiencies on patch', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId, {
      skillProficiencies: { athletics: 'proficient' },
    })
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ skillProficiencies: { acrobatics: 'expertise' } }),
    })
    const body = await res.json() as any
    expect(body.skills.athletics.proficiency).toBe('proficient')  // preserved
    expect(body.skills.acrobatics.proficiency).toBe('expertise')  // newly added
  })
})

// ── DELETE /characters/:id ───────────────────────────────────────────────────

describe('DELETE /api/v1/characters/:id', () => {
  it('owner can delete own character', async () => {
    const token = await registerAndLogin()
    const { campaignId } = await createCampaignAndGetId(token)
    const createRes = await createCharacter(token, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(res.status).toBe(204)

    const getRes = await app.request(`/api/v1/characters/${id}`, {
      headers: authHeaders(token),
    })
    expect(getRes.status).toBe(404)
  })

  it('DM can delete any character in the campaign', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const playerToken = await registerAndLogin('player@test.com', 'password123', 'Player')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ inviteCode }),
    })

    const createRes = await createCharacter(playerToken, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'DELETE',
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(204)
  })

  it('non-owner player cannot delete another player character', async () => {
    const dmToken = await registerAndLogin('dm@test.com')
    const player1Token = await registerAndLogin('p1@test.com', 'password123', 'P1')
    const player2Token = await registerAndLogin('p2@test.com', 'password123', 'P2')
    const { campaignId, inviteCode } = await createCampaignAndGetId(dmToken)

    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(player1Token),
      body: JSON.stringify({ inviteCode }),
    })
    await app.request('/api/v1/campaigns/join', {
      method: 'POST',
      headers: authHeaders(player2Token),
      body: JSON.stringify({ inviteCode }),
    })

    const createRes = await createCharacter(player1Token, campaignId)
    const { id } = await createRes.json() as any

    const res = await app.request(`/api/v1/characters/${id}`, {
      method: 'DELETE',
      headers: authHeaders(player2Token),
    })
    expect(res.status).toBe(403)
  })
})
