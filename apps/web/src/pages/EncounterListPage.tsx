import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getEncounters,
  createEncounter,
  deleteEncounter,
  type EncounterSummary,
} from '../api/client'

const STATUS_BADGE: Record<string, string> = {
  preparing: 'bg-stone-600 text-stone-200',
  active: 'bg-green-600/30 text-green-400',
  completed: 'bg-stone-700 text-stone-400',
}

export function EncounterListPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [encounters, setEncounters] = useState<EncounterSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EncounterSummary | null>(null)

  useEffect(() => {
    if (!campaignId) return
    getEncounters(campaignId)
      .then(setEncounters)
      .catch(() => navigate(`/campaigns/${campaignId}`))
      .finally(() => setLoading(false))
  }, [campaignId, navigate])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId || !newName.trim()) return
    setCreating(true)
    try {
      const enc = await createEncounter(campaignId, newName.trim())
      setEncounters(prev => [enc, ...prev])
      setNewName('')
      setShowCreate(false)
      navigate(`/campaigns/${campaignId}/encounters/${enc.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(enc: EncounterSummary) {
    if (!campaignId) return
    await deleteEncounter(campaignId, enc.id)
    setEncounters(prev => prev.filter(e => e.id !== enc.id))
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
        <h1 className="text-xl font-bold text-amber-400">Encounters</h1>
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold text-sm rounded-lg transition-colors"
          >
            + New Encounter
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : encounters.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-500 mb-4">No encounters yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg"
            >
              Create First Encounter
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {encounters.map(enc => (
              <li
                key={enc.id}
                className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">{enc.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[enc.status]}`}>
                      {enc.status === 'preparing' ? 'Preparing'
                        : enc.status === 'active' ? `Active · Round ${enc.round}`
                        : 'Completed'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">{enc.combatantCount} combatant{enc.combatantCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/campaigns/${campaignId}/encounters/${enc.id}`)}
                    className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold rounded-lg transition-colors"
                  >
                    {enc.status === 'preparing' ? 'Set Up' : 'Open'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(enc)}
                    className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">New Encounter</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Name</label>
                <input
                  autoFocus
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Goblin Ambush"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
          onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete encounter?</h3>
            <p className="text-stone-400 text-sm mb-6">
              <span className="text-stone-200 font-medium">{deleteTarget.name}</span> and all its combatants will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
              >
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
