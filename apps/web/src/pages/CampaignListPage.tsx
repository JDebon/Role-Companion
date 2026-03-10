import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, createCampaign, joinCampaign, type Campaign } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function CampaignListPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'join' | null>(null)

  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)

  useEffect(() => {
    getCampaigns()
      .then(setCampaigns)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)
    try {
      const c = await createCampaign(createName.trim())
      setModal(null)
      setCreateName('')
      navigate(`/campaigns/${c.id}`)
    } catch {
      setCreateError('Failed to create campaign. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)
    setJoinLoading(true)
    try {
      const c = await joinCampaign(joinCode.trim().toUpperCase())
      setModal(null)
      setJoinCode('')
      navigate(`/campaigns/${c.id}`)
    } catch (err: unknown) {
      const e = err as { message?: string }
      if (e.message === 'INVALID_INVITE_CODE') {
        setJoinError('Invalid or expired invite code.')
      } else if (e.message === 'ALREADY_MEMBER') {
        setJoinError('You are already a member of this campaign.')
      } else {
        setJoinError('Something went wrong. Please try again.')
      }
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-amber-400">RoleCompanion</h1>
        <div className="flex items-center gap-4">
          <span className="text-stone-400 text-sm">{user?.displayName}</span>
          <button
            onClick={signOut}
            className="text-sm text-stone-400 hover:text-stone-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Your Campaigns</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setModal('join')}
              className="px-4 py-2 text-sm border border-stone-600 hover:border-stone-400 rounded-lg transition-colors"
            >
              Join
            </button>
            <button
              onClick={() => setModal('create')}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              New Campaign
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <p className="text-lg mb-2">No campaigns yet.</p>
            <p className="text-sm">Create one or join with an invite code.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                  className="w-full text-left px-5 py-4 bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 rounded-xl transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-stone-100">{c.name}</p>
                    <p className="text-stone-400 text-sm mt-0.5">
                      {c.memberCount} member{c.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      c.role === 'dungeon_master'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-sky-500/20 text-sky-400'
                    }`}
                  >
                    {c.role === 'dungeon_master' ? 'Dungeon Master' : 'Player'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Create modal */}
      {modal === 'create' && (
        <Modal title="New Campaign" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-stone-300 mb-1">Campaign name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                maxLength={100}
                autoFocus
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                placeholder="The Lost Mines of Phandelver"
              />
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading || !createName.trim()}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
              >
                {createLoading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Join modal */}
      {modal === 'join' && (
        <Modal title="Join a Campaign" onClose={() => setModal(null)}>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm text-stone-300 mb-1">Invite code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                autoFocus
                maxLength={16}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 uppercase tracking-widest"
                placeholder="AB12CD34"
              />
            </div>
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={joinLoading || !joinCode.trim()}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
              >
                {joinLoading ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
