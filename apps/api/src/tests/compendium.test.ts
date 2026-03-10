import { describe, it, expect, beforeAll } from 'vitest'
import app from '../app.js'
import { transformSpell, transformMonster } from '../../../../packages/db/src/srd-transforms.js'

// ── Unit tests: transform functions ──────────────────────────────────────────

describe('transformSpell', () => {
  it('extracts level, school, concentration, ritual, and classes', () => {
    const raw = {
      index: 'fireball',
      name: 'Fireball',
      level: 3,
      school: { name: 'Evocation' },
      concentration: false,
      ritual: false,
      classes: [{ name: 'Sorcerer' }, { name: 'Wizard' }],
    }
    const result = transformSpell(raw)
    expect(result.index).toBe('fireball')
    expect(result.name).toBe('Fireball')
    expect(result.level).toBe(3)
    expect(result.school).toBe('Evocation')
    expect(result.concentration).toBe(false)
    expect(result.ritual).toBe(false)
    expect(result.classes).toEqual(['Sorcerer', 'Wizard'])
    expect(result.data).toBe(raw)
  })

  it('defaults missing fields gracefully', () => {
    const raw = { index: 'x', name: 'X' }
    const result = transformSpell(raw)
    expect(result.level).toBe(0)
    expect(result.school).toBe('')
    expect(result.concentration).toBe(false)
    expect(result.ritual).toBe(false)
    expect(result.classes).toEqual([])
  })
})

describe('transformMonster', () => {
  it('extracts challenge_rating, type, size', () => {
    const raw = {
      index: 'goblin',
      name: 'Goblin',
      challenge_rating: 0.25,
      type: 'humanoid',
      size: 'Small',
    }
    const result = transformMonster(raw)
    expect(result.index).toBe('goblin')
    expect(result.challengeRating).toBe('0.25')
    expect(result.monsterType).toBe('humanoid')
    expect(result.size).toBe('Small')
  })

  it('handles integer CR', () => {
    const raw = { index: 'dragon', name: 'Dragon', challenge_rating: 5, type: 'dragon', size: 'Huge' }
    expect(transformMonster(raw).challengeRating).toBe('5')
  })

  it('handles missing CR', () => {
    const raw = { index: 'x', name: 'X', type: 't', size: 's' }
    expect(transformMonster(raw).challengeRating).toBe('0')
  })
})

// ── Integration tests ─────────────────────────────────────────────────────────

async function registerAndLogin(): Promise<string> {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'comp@test.com', password: 'password123', displayName: 'Tester' }),
  })
  const { token } = await res.json()
  return token as string
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

let token: string

beforeAll(async () => {
  token = await registerAndLogin()
})

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Compendium auth guard', () => {
  it('returns 401 without JWT', async () => {
    const res = await app.request('/api/v1/compendium/spells')
    expect(res.status).toBe(401)
  })
})

// ── Spells ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/compendium/spells', () => {
  it('returns paginated spell list', async () => {
    const res = await app.request('/api/v1/compendium/spells?limit=5', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.total).toBeGreaterThan(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(5)
  })

  it('?q=fire returns spells including Fireball', async () => {
    const res = await app.request('/api/v1/compendium/spells?q=fire', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    const names = (data as Array<{ name: string }>).map((s) => s.name)
    expect(names).toContain('Fireball')
    expect(names.some((n) => n.toLowerCase().includes('fire'))).toBe(true)
  })

  it('?level=3&school=Evocation returns only level-3 Evocation spells', async () => {
    const res = await app.request('/api/v1/compendium/spells?level=3&school=Evocation', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.length).toBeGreaterThan(0)
    for (const spell of data as Array<{ level: number; school: string }>) {
      expect(spell.level).toBe(3)
      expect(spell.school.toLowerCase()).toBe('evocation')
    }
  })

  it('total >= 319 (full SRD spell count)', async () => {
    const res = await app.request('/api/v1/compendium/spells?limit=1', {
      headers: auth(token),
    })
    const { total } = await res.json()
    expect(total).toBeGreaterThanOrEqual(319)
  })
})

describe('GET /api/v1/compendium/spells/:index', () => {
  it('returns full spell data for fireball (level 3)', async () => {
    const res = await app.request('/api/v1/compendium/spells/fireball', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.level).toBe(3)
    expect(body.name).toBe('Fireball')
  })

  it('returns 404 for unknown index', async () => {
    const res = await app.request('/api/v1/compendium/spells/does-not-exist', {
      headers: auth(token),
    })
    expect(res.status).toBe(404)
  })
})

// ── Monsters ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/compendium/monsters', () => {
  it('returns paginated monster list', async () => {
    const res = await app.request('/api/v1/compendium/monsters?limit=5', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.total).toBeGreaterThanOrEqual(334)
  })

  it('?q=goblin returns goblins', async () => {
    const res = await app.request('/api/v1/compendium/monsters?q=goblin', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.length).toBeGreaterThan(0)
    const names = (data as Array<{ name: string }>).map((m) => m.name)
    expect(names).toContain('Goblin')
  })

  it('?cr=0.25 returns only CR 1/4 monsters', async () => {
    const res = await app.request('/api/v1/compendium/monsters?cr=0.25', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.length).toBeGreaterThan(0)
    for (const m of data as Array<{ challengeRating: string }>) {
      expect(parseFloat(m.challengeRating)).toBeCloseTo(0.25)
    }
  })
})

describe('GET /api/v1/compendium/monsters/:index', () => {
  it('returns full stat block for goblin (HP 7, AC 15)', async () => {
    const res = await app.request('/api/v1/compendium/monsters/goblin', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Goblin')
    expect(body.hit_points).toBe(7)
    const ac = (body.armor_class as Array<{ value: number }>)[0].value
    expect(ac).toBe(15)
  })

  it('returns 404 for unknown monster', async () => {
    const res = await app.request('/api/v1/compendium/monsters/does-not-exist', {
      headers: auth(token),
    })
    expect(res.status).toBe(404)
  })
})

// ── Equipment ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/compendium/equipment', () => {
  it('returns equipment list', async () => {
    const res = await app.request('/api/v1/compendium/equipment?limit=5', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('?q=sword returns weapons with sword in name', async () => {
    const res = await app.request('/api/v1/compendium/equipment?q=sword', {
      headers: auth(token),
    })
    const { data } = await res.json()
    expect(data.length).toBeGreaterThan(0)
    for (const item of data as Array<{ name: string }>) {
      expect(item.name.toLowerCase()).toContain('sword')
    }
  })
})

describe('GET /api/v1/compendium/equipment/:index', () => {
  it('returns full item data for longsword', async () => {
    const res = await app.request('/api/v1/compendium/equipment/longsword', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Longsword')
  })

  it('returns 404 for unknown item', async () => {
    const res = await app.request('/api/v1/compendium/equipment/does-not-exist', {
      headers: auth(token),
    })
    expect(res.status).toBe(404)
  })
})

// ── Generic collections ───────────────────────────────────────────────────────

describe('GET /api/v1/compendium/:collection', () => {
  it('returns classes list', async () => {
    const res = await app.request('/api/v1/compendium/classes', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    const names = (data as Array<{ name: string }>).map((c) => c.name)
    expect(names).toContain('Wizard')
  })

  it('returns races list', async () => {
    const res = await app.request('/api/v1/compendium/races', { headers: auth(token) })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    const names = (data as Array<{ name: string }>).map((r) => r.name)
    expect(names).toContain('Elf')
  })

  it('?q= filters by name', async () => {
    const res = await app.request('/api/v1/compendium/skills?q=ath', {
      headers: auth(token),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.length).toBeGreaterThan(0)
    for (const s of data as Array<{ name: string }>) {
      expect(s.name.toLowerCase()).toContain('ath')
    }
  })

  it('returns 404 for unknown collection', async () => {
    const res = await app.request('/api/v1/compendium/unknown-collection', {
      headers: auth(token),
    })
    expect(res.status).toBe(404)
  })
})
