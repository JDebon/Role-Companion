import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { clearDb } from './setup.js'

beforeEach(clearDb)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function register(email: string, password: string, displayName: string) {
  const res = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  })
  const { token } = await res.json()
  return token as string
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function createCampaign(token: string, name = 'Test Campaign') {
  const res = await app.request('/api/v1/campaigns', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  })
  return res.json() as Promise<{ id: string; inviteCode: string }>
}

async function joinCampaign(token: string, inviteCode: string) {
  const res = await app.request('/api/v1/campaigns/join', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ inviteCode }),
  })
  return res.json() as Promise<{ id: string }>
}

async function createCharacter(token: string, campaignId: string, name = 'Test Hero') {
  const res = await app.request(`/api/v1/campaigns/${campaignId}/characters`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      className: 'Fighter',
      raceName: 'Human',
      backgroundName: 'Soldier',
      level: 1,
      str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10,
      maxHp: 12, currentHp: 12,
      armorClass: 16, speed: 30,
      skillProficiencies: {},
      savingThrowProficiencies: {},
    }),
  })
  return res.json() as Promise<{ id: string }>
}

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('note visibility logic', () => {
  it('returns 403 when a different player tries to read another player character notes', async () => {
    const dmToken = await register('dm@test.com', 'password123', 'DM')
    const playerToken = await register('player@test.com', 'password123', 'Player')
    const otherToken = await register('other@test.com', 'password123', 'Other')

    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    await joinCampaign(otherToken, campaign.inviteCode)

    const char = await createCharacter(playerToken, campaign.id)

    // Create a note as the player
    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Secret note', content: 'Private content' }),
    })

    // Other player tries to read — should get 403
    const res = await app.request(`/api/v1/characters/${char.id}/notes`, {
      headers: authHeaders(otherToken),
    })
    expect(res.status).toBe(403)
  })

  it('DM can read any character notes', async () => {
    const dmToken = await register('dm2@test.com', 'password123', 'DM')
    const playerToken = await register('player2@test.com', 'password123', 'Player')

    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const char = await createCharacter(playerToken, campaign.id)

    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'A note', content: 'Content' }),
    })

    const res = await app.request(`/api/v1/characters/${char.id}/notes`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as unknown[]
    expect(Array.isArray(notes)).toBe(true)
    expect(notes.length).toBe(1)
  })
})

describe('duplicate session number rejection', () => {
  it('rejects a second session log with the same session number', async () => {
    const dmToken = await register('dm3@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1 duplicate' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('DUPLICATE_SESSION_NUMBER')
  })
})

// ── Character Notes Integration Tests ────────────────────────────────────────

describe('character notes', () => {
  it('player creates a note on their character → 201', async () => {
    const dmToken = await register('dm4@test.com', 'password123', 'DM')
    const playerToken = await register('player4@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const res = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'My Note', content: 'Remember the dragon' }),
    })
    expect(res.status).toBe(201)
    const note = await res.json() as { id: string; title: string; isRevealed: boolean }
    expect(note.title).toBe('My Note')
    expect(note.isRevealed).toBe(false)
  })

  it('player can list their own notes', async () => {
    const dmToken = await register('dm5@test.com', 'password123', 'DM')
    const playerToken = await register('player5@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Note A', content: 'Content A' }),
    })
    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Note B', content: 'Content B' }),
    })

    const res = await app.request(`/api/v1/characters/${char.id}/notes`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as unknown[]
    expect(notes.length).toBe(2)
  })

  it('player can get a single note by id', async () => {
    const dmToken = await register('dm6@test.com', 'password123', 'DM')
    const playerToken = await register('player6@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const createRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Detailed note', content: 'Full content' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/characters/${char.id}/notes/${noteId}`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const note = await res.json() as { id: string; content: string }
    expect(note.id).toBe(noteId)
    expect(note.content).toBe('Full content')
  })

  it('player can edit their own note', async () => {
    const dmToken = await register('dm7@test.com', 'password123', 'DM')
    const playerToken = await register('player7@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const createRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Old title', content: 'Old content' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const patchRes = await app.request(`/api/v1/characters/${char.id}/notes/${noteId}`, {
      method: 'PATCH',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'New title', content: 'New content' }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as { title: string; content: string }
    expect(updated.title).toBe('New title')
    expect(updated.content).toBe('New content')
  })

  it('player can delete their own note', async () => {
    const dmToken = await register('dm8@test.com', 'password123', 'DM')
    const playerToken = await register('player8@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const createRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'To delete', content: '' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const delRes = await app.request(`/api/v1/characters/${char.id}/notes/${noteId}`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(delRes.status).toBe(204)

    // Confirm it's gone
    const listRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      headers: authHeaders(playerToken),
    })
    const notes = await listRes.json() as unknown[]
    expect(notes.length).toBe(0)
  })

  it('non-author cannot edit a note → 403', async () => {
    const dmToken = await register('dm9@test.com', 'password123', 'DM')
    const playerToken = await register('player9@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const createRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Player note', content: 'Content' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    // DM tries to edit the player's note
    const res = await app.request(`/api/v1/characters/${char.id}/notes/${noteId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'DM edit' }),
    })
    expect(res.status).toBe(403)
  })

  it('non-author cannot delete a note → 403', async () => {
    const dmToken = await register('dm10@test.com', 'password123', 'DM')
    const playerToken = await register('player10@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const createRes = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Player note', content: '' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/characters/${char.id}/notes/${noteId}`, {
      method: 'DELETE',
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 for a note that does not exist', async () => {
    const dmToken = await register('dm11@test.com', 'password123', 'DM')
    const playerToken = await register('player11@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const res = await app.request(`/api/v1/characters/${char.id}/notes/00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(404)
  })

  it('unauthenticated request returns 401', async () => {
    const res = await app.request('/api/v1/characters/00000000-0000-0000-0000-000000000000/notes')
    expect(res.status).toBe(401)
  })

  it('character notes search with ?q= filters by title', async () => {
    const dmToken = await register('dm12@test.com', 'password123', 'DM')
    const playerToken = await register('player12@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Dragon lair', content: 'Notes about the dragon' }),
    })
    await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Town map', content: 'Town notes' }),
    })

    const res = await app.request(`/api/v1/characters/${char.id}/notes?q=dragon`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as Array<{ title: string }>
    expect(notes.length).toBe(1)
    expect(notes[0].title).toBe('Dragon lair')
  })

  it('DM cannot create a character note on a player character → 403', async () => {
    const dmToken = await register('dm13@test.com', 'password123', 'DM')
    const playerToken = await register('player13@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)
    const char = await createCharacter(playerToken, campaign.id)

    const res = await app.request(`/api/v1/characters/${char.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'DM note on player char', content: '' }),
    })
    expect(res.status).toBe(403)
  })
})

// ── DM Notes Integration Tests ────────────────────────────────────────────────

describe('DM campaign notes', () => {
  it('DM creates a campaign note → 201', async () => {
    const dmToken = await register('dm14@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Secret DM note', content: 'The BBEG is...' }),
    })
    expect(res.status).toBe(201)
    const note = await res.json() as { id: string; title: string; isRevealed: boolean }
    expect(note.title).toBe('Secret DM note')
    expect(note.isRevealed).toBe(false)
  })

  it('player cannot create a campaign note → 403', async () => {
    const dmToken = await register('dm15@test.com', 'password123', 'DM')
    const playerToken = await register('player15@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Player note', content: '' }),
    })
    expect(res.status).toBe(403)
  })

  it('DM note does not appear in revealed list initially', async () => {
    const dmToken = await register('dm16@test.com', 'password123', 'DM')
    const playerToken = await register('player16@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Hidden note', content: 'Secret' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes/revealed`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as unknown[]
    expect(notes.length).toBe(0)
  })

  it('DM reveals a note → it appears in revealed list for all members', async () => {
    const dmToken = await register('dm17@test.com', 'password123', 'DM')
    const playerToken = await register('player17@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'To be revealed', content: 'Revealed content' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const revealRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}/reveal`, {
      method: 'POST',
      headers: authHeaders(dmToken),
    })
    expect(revealRes.status).toBe(200)
    const revealed = await revealRes.json() as { isRevealed: boolean }
    expect(revealed.isRevealed).toBe(true)

    // Check it appears in revealed list for player
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes/revealed`, {
      headers: authHeaders(playerToken),
    })
    const notes = await listRes.json() as Array<{ title: string }>
    expect(notes.length).toBe(1)
    expect(notes[0].title).toBe('To be revealed')
  })

  it('revealing an already-revealed note returns 409', async () => {
    const dmToken = await register('dm18@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Note', content: '' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}/reveal`, {
      method: 'POST',
      headers: authHeaders(dmToken),
    })

    // Try to reveal again
    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}/reveal`, {
      method: 'POST',
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('ALREADY_REVEALED')
  })

  it('player cannot reveal a DM note → 403', async () => {
    const dmToken = await register('dm19@test.com', 'password123', 'DM')
    const playerToken = await register('player19@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'DM note', content: '' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}/reveal`, {
      method: 'POST',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('DM can list their campaign notes', async () => {
    const dmToken = await register('dm20@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Note 1', content: '' }),
    })
    await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Note 2', content: '' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as unknown[]
    expect(notes.length).toBe(2)
  })

  it('player cannot list DM campaign notes → 403', async () => {
    const dmToken = await register('dm21@test.com', 'password123', 'DM')
    const playerToken = await register('player21@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('DM can edit their campaign note', async () => {
    const dmToken = await register('dm22@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Old', content: 'Old content' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const patchRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'New', content: 'New content' }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as { title: string; content: string }
    expect(updated.title).toBe('New')
    expect(updated.content).toBe('New content')
  })

  it('DM can delete their campaign note', async () => {
    const dmToken = await register('dm23@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'To delete', content: '' }),
    })
    const { id: noteId } = await createRes.json() as { id: string }

    const delRes = await app.request(`/api/v1/campaigns/${campaign.id}/notes/${noteId}`, {
      method: 'DELETE',
      headers: authHeaders(dmToken),
    })
    expect(delRes.status).toBe(204)
  })

  it('revealed notes can be searched with ?q=', async () => {
    const dmToken = await register('dm24@test.com', 'password123', 'DM')
    const playerToken = await register('player24@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const c1 = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Dragon lore', content: 'Fire dragons exist' }),
    })
    const { id: n1 } = await c1.json() as { id: string }
    const c2 = await app.request(`/api/v1/campaigns/${campaign.id}/notes`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Town news', content: 'The market is open' }),
    })
    const { id: n2 } = await c2.json() as { id: string }

    await app.request(`/api/v1/campaigns/${campaign.id}/notes/${n1}/reveal`, { method: 'POST', headers: authHeaders(dmToken) })
    await app.request(`/api/v1/campaigns/${campaign.id}/notes/${n2}/reveal`, { method: 'POST', headers: authHeaders(dmToken) })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/notes/revealed?q=dragon`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const notes = await res.json() as Array<{ title: string }>
    expect(notes.length).toBe(1)
    expect(notes[0].title).toBe('Dragon lore')
  })
})

// ── Session Logs Integration Tests ────────────────────────────────────────────

describe('session logs', () => {
  it('DM creates a session log → 201 visible to all members', async () => {
    const dmToken = await register('dm25@test.com', 'password123', 'DM')
    const playerToken = await register('player25@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 3, title: 'Into the dungeon', content: 'The party descended...' }),
    })
    expect(res.status).toBe(201)
    const log = await res.json() as { id: string; sessionNumber: number; title: string; isPinned: boolean }
    expect(log.sessionNumber).toBe(3)
    expect(log.title).toBe('Into the dungeon')
    expect(log.isPinned).toBe(false)

    // Player can see it
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      headers: authHeaders(playerToken),
    })
    expect(listRes.status).toBe(200)
    const logs = await listRes.json() as unknown[]
    expect(logs.length).toBe(1)
  })

  it('player cannot create a session log → 403', async () => {
    const dmToken = await register('dm26@test.com', 'password123', 'DM')
    const playerToken = await register('player26@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'My log' }),
    })
    expect(res.status).toBe(403)
  })

  it('duplicate session number → 409', async () => {
    const dmToken = await register('dm27@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 5, title: 'Session 5' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 5, title: 'Session 5 again' }),
    })
    expect(res.status).toBe(409)
  })

  it('get single session log by id', async () => {
    const dmToken = await register('dm28@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 2, title: 'Session 2', content: 'We fought goblins' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const log = await res.json() as { sessionNumber: number; content: string }
    expect(log.sessionNumber).toBe(2)
    expect(log.content).toBe('We fought goblins')
  })

  it('session logs are sorted descending by session number', async () => {
    const dmToken = await register('dm29@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 3, title: 'Session 3' }),
    })
    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 2, title: 'Session 2' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      headers: authHeaders(dmToken),
    })
    const logs = await res.json() as Array<{ sessionNumber: number }>
    expect(logs[0].sessionNumber).toBe(3)
    expect(logs[1].sessionNumber).toBe(2)
    expect(logs[2].sessionNumber).toBe(1)
  })

  it('pin a session log — only one log is pinned at a time', async () => {
    const dmToken = await register('dm30@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const r1 = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    const { id: log1Id } = await r1.json() as { id: string }

    const r2 = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 2, title: 'Session 2' }),
    })
    const { id: log2Id } = await r2.json() as { id: string }

    // Pin log 1
    const pin1Res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${log1Id}/pin`, {
      method: 'POST',
      headers: authHeaders(dmToken),
    })
    expect(pin1Res.status).toBe(200)
    const pin1 = await pin1Res.json() as { isPinned: boolean }
    expect(pin1.isPinned).toBe(true)

    // Pin log 2 — should unpin log 1
    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${log2Id}/pin`, {
      method: 'POST',
      headers: authHeaders(dmToken),
    })

    // Verify: only log2 is pinned
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      headers: authHeaders(dmToken),
    })
    const logs = await listRes.json() as Array<{ id: string; isPinned: boolean }>
    const log1Row = logs.find((l) => l.id === log1Id)!
    const log2Row = logs.find((l) => l.id === log2Id)!
    expect(log1Row.isPinned).toBe(false)
    expect(log2Row.isPinned).toBe(true)
  })

  it('DM can edit a session log', async () => {
    const dmToken = await register('dm31@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Old title', content: 'Old' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const patchRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'New title', content: 'New content' }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as { title: string; content: string }
    expect(updated.title).toBe('New title')
    expect(updated.content).toBe('New content')
  })

  it('player cannot edit a session log → 403', async () => {
    const dmToken = await register('dm32@test.com', 'password123', 'DM')
    const playerToken = await register('player32@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}`, {
      method: 'PATCH',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Player edit' }),
    })
    expect(res.status).toBe(403)
  })

  it('DM can delete a session log', async () => {
    const dmToken = await register('dm33@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const delRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}`, {
      method: 'DELETE',
      headers: authHeaders(dmToken),
    })
    expect(delRes.status).toBe(204)

    // Confirm it is gone
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      headers: authHeaders(dmToken),
    })
    const logs = await listRes.json() as unknown[]
    expect(logs.length).toBe(0)
  })

  it('player cannot delete a session log → 403', async () => {
    const dmToken = await register('dm34@test.com', 'password123', 'DM')
    const playerToken = await register('player34@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('player cannot pin a session log → 403', async () => {
    const dmToken = await register('dm35@test.com', 'password123', 'DM')
    const playerToken = await register('player35@test.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Session 1' }),
    })
    const { id: logId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/${logId}/pin`, {
      method: 'POST',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('keyword search with ?q= filters session logs by title', async () => {
    const dmToken = await register('dm36@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 1, title: 'Battle at the bridge', content: 'Combat recap' }),
    })
    await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ sessionNumber: 2, title: 'Tavern meeting', content: 'Roleplay heavy session' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs?q=battle`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const logs = await res.json() as Array<{ title: string }>
    expect(logs.length).toBe(1)
    expect(logs[0].title).toBe('Battle at the bridge')
  })

  it('returns 404 for session log not found', async () => {
    const dmToken = await register('dm37@test.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs/00000000-0000-0000-0000-000000000000`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(404)
  })

  it('non-member cannot access session logs → 404', async () => {
    const dmToken = await register('dm38@test.com', 'password123', 'DM')
    const strangerToken = await register('stranger@test.com', 'password123', 'Stranger')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/session-logs`, {
      headers: authHeaders(strangerToken),
    })
    expect(res.status).toBe(404)
  })
})
