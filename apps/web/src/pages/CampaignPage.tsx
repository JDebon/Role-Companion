import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCampaignMembers,
  getCampaignCharacters,
  regenerateInvite,
  removeMember,
  type Member,
  type CharacterSummary,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<Member[]>([])
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenLoading, setRegenLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const myRole = members.find((m) => m.userId === user?.id)?.role
  const isDM = myRole === 'dungeon_master'

  useEffect(() => {
    if (!id) return
    Promise.all([getCampaignMembers(id), getCampaignCharacters(id)])
      .then(([mems, chars]) => { setMembers(mems); setCharacters(chars) })
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function handleRegenerate() {
    if (!id) return
    setRegenLoading(true)
    try {
      const { inviteCode: newCode } = await regenerateInvite(id)
      setInviteCode(newCode)
    } finally {
      setRegenLoading(false)
    }
  }

  async function handleRemove(member: Member) {
    if (!id) return
    await removeMember(id, member.userId)
    setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
    setRemoveTarget(null)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function hpBarColor(current: number, max: number) {
    const pct = max > 0 ? current / max : 0
    if (pct > 0.5) return 'bg-green-500'
    if (pct > 0.25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/campaigns')}
          className="text-stone-400 hover:text-stone-200 transition-colors"
          aria-label="Back"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">Campaign</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : (
          <>
            {/* Characters */}
            <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Characters ({characters.length})</h2>
                <button
                  onClick={() => navigate(`/campaigns/${id}/characters/new`)}
                  className="px-3 py-1.5 text-sm bg-crimson-500 hover:bg-crimson-400 text-white font-semibold rounded-lg transition-colors"
                >
                  + New Character
                </button>
              </div>

              {characters.length === 0 ? (
                <p className="text-stone-500 text-sm">No characters yet. Create one to get started.</p>
              ) : (
                <ul className="space-y-2">
                  {characters.map((ch) => (
                    <li key={ch.id}>
                      <button
                        onClick={() =>
                          ch.status === 'draft'
                            ? navigate(`/campaigns/${id}/characters/new?draft=${ch.id}`)
                            : navigate(`/characters/${ch.id}`)
                        }
                        className="w-full flex items-center gap-4 p-3 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                          {ch.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {ch.name}
                            {ch.status === 'draft' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Draft</span>
                            )}
                          </p>
                          <p className="text-xs text-stone-400">{ch.className} · {ch.raceName}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-stone-600 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${hpBarColor(ch.currentHp, ch.maxHp)}`}
                                style={{ width: `${ch.maxHp > 0 ? (ch.currentHp / ch.maxHp) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-stone-400 font-mono flex-shrink-0">
                              {ch.currentHp}/{ch.maxHp} HP
                            </span>
                          </div>
                        </div>
                        <span className="text-stone-500 text-sm">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* DM Tools — Encounters + NPCs (DM only) */}
            {isDM && (
              <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">DM Tools</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/campaigns/${id}/encounters`)}
                    className="flex-1 px-4 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 rounded-xl transition-colors text-left"
                  >
                    <p className="font-semibold text-sm text-amber-400">Encounters</p>
                    <p className="text-xs text-stone-400 mt-0.5">Run combat with initiative tracking</p>
                  </button>
                  <button
                    onClick={() => navigate(`/campaigns/${id}/npcs`)}
                    className="flex-1 px-4 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 rounded-xl transition-colors text-left"
                  >
                    <p className="font-semibold text-sm text-amber-400">NPCs</p>
                    <p className="text-xs text-stone-400 mt-0.5">Manage campaign NPCs</p>
                  </button>
                  <button
                    onClick={() => navigate(`/campaigns/${id}/session-logs`)}
                    className="px-4 py-3 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors text-left"
                  >
                    <p className="font-semibold text-sm">Session Logs</p>
                    <p className="text-xs text-stone-400 mt-0.5">Record and share session recaps</p>
                  </button>
                  <button
                    onClick={() => navigate(`/campaigns/${id}/dm-notes`)}
                    className="px-4 py-3 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors text-left"
                  >
                    <p className="font-semibold text-sm">Notes</p>
                    <p className="text-xs text-stone-400 mt-0.5">Private DM notes and revealed lore</p>
                  </button>
                  <button
                    onClick={() => navigate(`/campaigns/${id}/lore`)}
                    className="px-4 py-3 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors text-left"
                  >
                    <p className="font-semibold text-sm">World Lore</p>
                    <p className="text-xs text-stone-400 mt-0.5">Author and publish world-building documents</p>
                  </button>
                </div>
              </section>
            )}

            {/* Notes & Lore — visible to players too */}
            {!isDM && (
              <>
                <section className="bg-stone-900 border border-stone-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Notes</h2>
                    <button
                      onClick={() => navigate(`/campaigns/${id}/dm-notes`)}
                      className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 text-stone-100 font-semibold rounded-lg transition-colors"
                    >
                      View Revealed Notes
                    </button>
                  </div>
                  <p className="text-stone-500 text-sm">
                    View lore and notes your DM has revealed to the party.
                  </p>
                </section>
                <section className="bg-stone-900 border border-stone-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">World Lore</h2>
                    <button
                      onClick={() => navigate(`/campaigns/${id}/lore`)}
                      className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 text-stone-100 font-semibold rounded-lg transition-colors"
                    >
                      Browse Lore
                    </button>
                  </div>
                  <p className="text-stone-500 text-sm">
                    Read world-building documents your DM has published.
                  </p>
                </section>
              </>
            )}

            {/* Custom Content */}
            <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Custom Content</h2>
                <button
                  onClick={() => navigate(`/campaigns/${id}/custom-content`)}
                  className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 text-stone-100 font-semibold rounded-lg transition-colors"
                >
                  View All
                </button>
              </div>
              <p className="text-stone-500 text-sm">
                {isDM ? 'Create homebrew monsters, items, and rules for this campaign.' : 'View the homebrew content your DM has created.'}
              </p>
            </section>

            {/* Invite code (DM only) */}
            {isDM && (
              <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Invite Code</h2>
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-mono text-2xl tracking-widest text-amber-300 bg-stone-800 px-4 py-2 rounded-lg">
                    {inviteCode ?? '••••••••'}
                  </span>
                  {inviteCode && (
                    <button
                      onClick={() => copyCode(inviteCode)}
                      className="px-3 py-2 text-sm border border-stone-600 hover:border-stone-400 rounded-lg transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                  <button
                    onClick={handleRegenerate}
                    disabled={regenLoading}
                    className="px-3 py-2 text-sm bg-crimson-500 hover:bg-crimson-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                  >
                    {regenLoading ? '…' : inviteCode ? 'Regenerate' : 'Show code'}
                  </button>
                </div>
                {inviteCode && (
                  <p className="text-stone-500 text-xs mt-2">
                    Share this code with players. Regenerating invalidates the old one.
                  </p>
                )}
              </section>
            )}

            {/* Members list */}
            <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">
                Members ({members.length})
              </h2>
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-sm font-semibold text-stone-300">
                        {m.displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {m.displayName}
                          {m.userId === user?.id && (
                            <span className="text-stone-500 ml-1">(you)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          m.role === 'dungeon_master'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-sky-500/20 text-sky-400'
                        }`}
                      >
                        {m.role === 'dungeon_master' ? 'DM' : 'Player'}
                      </span>
                      {isDM && m.userId !== user?.id && (
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      {/* Remove confirmation dialog */}
      {removeTarget && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setRemoveTarget(null)}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Remove player?</h3>
            <p className="text-stone-400 text-sm mb-6">
              <span className="text-stone-200 font-medium">{removeTarget.displayName}</span>{' '}
              will lose access to this campaign immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeTarget)}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
