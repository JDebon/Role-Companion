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

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('lore document visibility guard', () => {
  it('player cannot read unpublished lore document by id → 403', async () => {
    const dmToken = await register('dm@lore.com', 'password123', 'DM')
    const playerToken = await register('player@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Secret lore', content: 'Hidden content' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('player cannot create a lore document → 403', async () => {
    const dmToken = await register('dm2@lore.com', 'password123', 'DM')
    const playerToken = await register('player2@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'My lore', content: 'Content' }),
    })
    expect(res.status).toBe(403)
  })
})

// ── Integration tests ─────────────────────────────────────────────────────────

describe('lore documents', () => {
  it('DM creates a lore document → 201 with isPublished false', async () => {
    const dmToken = await register('dm3@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'History of Eldoria', content: 'Long ago...' }),
    })
    expect(res.status).toBe(201)
    const doc = await res.json() as { id: string; title: string; isPublished: boolean }
    expect(doc.title).toBe('History of Eldoria')
    expect(doc.isPublished).toBe(false)
  })

  it('unpublished document does not appear in player list', async () => {
    const dmToken = await register('dm4@lore.com', 'password123', 'DM')
    const playerToken = await register('player4@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Secret Doc', content: 'Hidden' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(200)
    const docs = await res.json() as unknown[]
    expect(docs.length).toBe(0)
  })

  it('DM can see unpublished documents in their list', async () => {
    const dmToken = await register('dm5@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Draft Doc', content: 'Content' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const docs = await res.json() as unknown[]
    expect(docs.length).toBe(1)
  })

  it('DM publishes a document → player can see it', async () => {
    const dmToken = await register('dm6@lore.com', 'password123', 'DM')
    const playerToken = await register('player6@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Published Doc', content: 'World info' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    // Publish it
    const patchRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ isPublished: true }),
    })
    expect(patchRes.status).toBe(200)

    // Player can now see it in list
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(playerToken),
    })
    const docs = await listRes.json() as Array<{ title: string }>
    expect(docs.length).toBe(1)
    expect(docs[0].title).toBe('Published Doc')

    // Player can read full content
    const detailRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      headers: authHeaders(playerToken),
    })
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json() as { content: string }
    expect(detail.content).toBe('World info')
  })

  it('DM unpublishes a document → player can no longer see it', async () => {
    const dmToken = await register('dm7@lore.com', 'password123', 'DM')
    const playerToken = await register('player7@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Toggled Doc', content: 'Content' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    // Publish
    await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ isPublished: true }),
    })

    // Unpublish
    await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ isPublished: false }),
    })

    // Player list returns 0
    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(playerToken),
    })
    const docs = await listRes.json() as unknown[]
    expect(docs.length).toBe(0)

    // Player direct access returns 403
    const detailRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      headers: authHeaders(playerToken),
    })
    expect(detailRes.status).toBe(403)
  })

  it('DM can edit a lore document', async () => {
    const dmToken = await register('dm8@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Old title', content: 'Old content' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    const patchRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'New title', content: 'New content' }),
    })
    expect(patchRes.status).toBe(200)
    const updated = await patchRes.json() as { title: string; content: string }
    expect(updated.title).toBe('New title')
    expect(updated.content).toBe('New content')
  })

  it('DM can delete a lore document → 204', async () => {
    const dmToken = await register('dm9@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'To delete', content: '' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    const delRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'DELETE',
      headers: authHeaders(dmToken),
    })
    expect(delRes.status).toBe(204)

    const listRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(dmToken),
    })
    const docs = await listRes.json() as unknown[]
    expect(docs.length).toBe(0)
  })

  it('player cannot edit a lore document → 403', async () => {
    const dmToken = await register('dm10@lore.com', 'password123', 'DM')
    const playerToken = await register('player10@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Doc', content: 'Content' }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    // Publish so player can see it
    await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ isPublished: true }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'PATCH',
      headers: authHeaders(playerToken),
      body: JSON.stringify({ title: 'Player edit' }),
    })
    expect(res.status).toBe(403)
  })

  it('player cannot delete a lore document → 403', async () => {
    const dmToken = await register('dm11@lore.com', 'password123', 'DM')
    const playerToken = await register('player11@lore.com', 'password123', 'Player')
    const campaign = await createCampaign(dmToken)
    await joinCampaign(playerToken, campaign.inviteCode)

    const createRes = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Doc', content: 'Content', isPublished: true }),
    })
    const { id: docId } = await createRes.json() as { id: string }

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore/${docId}`, {
      method: 'DELETE',
      headers: authHeaders(playerToken),
    })
    expect(res.status).toBe(403)
  })

  it('keyword search ?q= filters lore documents by title and content', async () => {
    const dmToken = await register('dm12@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'Dragon Mythology', content: 'Fire and scales' }),
    })
    await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dmToken),
      body: JSON.stringify({ title: 'City of Ruins', content: 'Ancient civilisation' }),
    })

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore?q=dragon`, {
      headers: authHeaders(dmToken),
    })
    expect(res.status).toBe(200)
    const docs = await res.json() as Array<{ title: string }>
    expect(docs.length).toBe(1)
    expect(docs[0].title).toBe('Dragon Mythology')
  })

  it('non-member cannot access lore → 404', async () => {
    const dmToken = await register('dm13@lore.com', 'password123', 'DM')
    const strangerToken = await register('stranger@lore.com', 'password123', 'Stranger')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(`/api/v1/campaigns/${campaign.id}/lore`, {
      headers: authHeaders(strangerToken),
    })
    expect(res.status).toBe(404)
  })

  it('unauthenticated request returns 401', async () => {
    const res = await app.request('/api/v1/campaigns/00000000-0000-0000-0000-000000000000/lore')
    expect(res.status).toBe(401)
  })

  it('returns 404 for a document that does not exist', async () => {
    const dmToken = await register('dm14@lore.com', 'password123', 'DM')
    const campaign = await createCampaign(dmToken)

    const res = await app.request(
      `/api/v1/campaigns/${campaign.id}/lore/00000000-0000-0000-0000-000000000000`,
      { headers: authHeaders(dmToken) }
    )
    expect(res.status).toBe(404)
  })

  it('DM from campaign A cannot access campaign B lore', async () => {
    const dm1Token = await register('dm15@lore.com', 'password123', 'DM1')
    const dm2Token = await register('dm16@lore.com', 'password123', 'DM2')
    const campaign1 = await createCampaign(dm1Token, 'Campaign A')
    const campaign2 = await createCampaign(dm2Token, 'Campaign B')

    await app.request(`/api/v1/campaigns/${campaign2.id}/lore`, {
      method: 'POST',
      headers: authHeaders(dm2Token),
      body: JSON.stringify({ title: 'Campaign B Doc', content: 'Secret' }),
    })

    // DM1 tries to access campaign B's lore — should get 404 (not a member)
    const res = await app.request(`/api/v1/campaigns/${campaign2.id}/lore`, {
      headers: authHeaders(dm1Token),
    })
    expect(res.status).toBe(404)
  })
})
