import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getNpcs,
  createNpc,
  patchNpc,
  deleteNpc,
  type Npc,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getCampaignMembers } from '../api/client'

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface NpcModalProps {
  campaignId: string
  existing?: Npc
  onSaved: (npc: Npc) => void
  onClose: () => void
}

function NpcModal({ campaignId, existing, onSaved, onClose }: NpcModalProps) {
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    monsterIndex: existing?.monsterIndex ?? '',
    notes: existing?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        monsterIndex: form.monsterIndex.trim() || null,
        notes: form.notes,
      }
      let result: Npc
      if (existing) {
        result = await patchNpc(campaignId, existing.id, payload)
      } else {
        result = await createNpc(campaignId, payload)
      }
      onSaved(result)
      onClose()
    } catch {
      setError('Failed to save NPC.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{existing ? 'Edit NPC' : 'New NPC'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-400 mb-1">Name</label>
            <input
              required
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="Mirtala the Innkeeper"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">SRD Monster Base (optional)</label>
            <input
              value={form.monsterIndex}
              onChange={e => setForm(f => ({ ...f, monsterIndex: e.target.value }))}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="commoner"
            />
            <p className="text-xs text-stone-500 mt-1">
              SRD monster index for HP/AC. Leave blank for custom stat.
            </p>
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Friendly innkeeper, knows about the mine…"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg"
            >
              {loading ? 'Saving…' : existing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function NpcPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [npcs, setNpcs] = useState<Npc[]>([])
  const [loading, setLoading] = useState(true)
  const [isDM, setIsDM] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Npc | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Npc | null>(null)

  useEffect(() => {
    if (!campaignId) return
    Promise.all([getNpcs(campaignId), getCampaignMembers(campaignId)])
      .then(([npcList, members]) => {
        setNpcs(npcList)
        const myMembership = members.find(m => m.userId === user?.id)
        setIsDM(myMembership?.role === 'dungeon_master')
      })
      .catch(() => navigate(`/campaigns/${campaignId}`))
      .finally(() => setLoading(false))
  }, [campaignId, user, navigate])

  async function handleDelete(npc: Npc) {
    if (!campaignId) return
    await deleteNpc(campaignId, npc.id)
    setNpcs(prev => prev.filter(n => n.id !== npc.id))
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">NPCs</h1>
        {isDM && (
          <div className="ml-auto">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-sm rounded-lg"
            >
              + New NPC
            </button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : npcs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-500 mb-4">No NPCs yet.</p>
            {isDM && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg"
              >
                Create First NPC
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {npcs.map(npc => (
              <li
                key={npc.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{npc.name}</p>
                    {npc.monsterIndex && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        Base: <span className="text-amber-400 font-mono">{npc.monsterIndex}</span>
                      </p>
                    )}
                    {npc.notes && (
                      <p className="text-sm text-stone-400 mt-1 line-clamp-2">{npc.notes}</p>
                    )}
                  </div>
                  {isDM && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditTarget(npc)}
                        className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(npc)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && campaignId && (
        <NpcModal
          campaignId={campaignId}
          onSaved={npc => setNpcs(prev => [npc, ...prev])}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editTarget && campaignId && (
        <NpcModal
          campaignId={campaignId}
          existing={editTarget}
          onSaved={updated =>
            setNpcs(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)))
          }
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
          onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete NPC?</h3>
            <p className="text-stone-400 text-sm mb-6">
              <span className="text-stone-200 font-medium">{deleteTarget.name}</span> will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
