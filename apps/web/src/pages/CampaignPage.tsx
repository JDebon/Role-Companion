import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCampaignMembers,
  getCampaignCharacters,
  createCharacter,
  regenerateInvite,
  removeMember,
  type Member,
  type CharacterSummary,
  type CreateCharacterInput,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── Create Character Modal ────────────────────────────────────────────────────

interface CreateCharFormProps {
  campaignId: string
  onCreated: (char: CharacterSummary) => void
  onClose: () => void
}

function CreateCharForm({ campaignId, onCreated, onClose }: CreateCharFormProps) {
  const [form, setForm] = useState({
    name: '', className: '', raceName: '', backgroundName: '',
    level: 1,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    maxHp: 10, currentHp: 10,
    armorClass: 10, speed: 30,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = typeof form[key] === 'number' ? Number(e.target.value) : e.target.value
        setForm((f) => ({ ...f, [key]: v }))
      },
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.currentHp > form.maxHp) {
      setError('Current HP cannot exceed Max HP')
      return
    }
    setSubmitting(true)
    try {
      const data: CreateCharacterInput = { ...form }
      const sheet = await createCharacter(campaignId, data)
      onCreated({
        id: sheet.id,
        name: sheet.name,
        className: sheet.className,
        raceName: sheet.raceName,
        level: sheet.level,
        currentHp: sheet.hp.current,
        maxHp: sheet.hp.max,
        userId: sheet.userId,
      })
    } catch {
      setError('Failed to create character. Check all fields.')
    } finally {
      setSubmitting(false)
    }
  }

  const abilityFields: Array<{ key: keyof typeof form; label: string }> = [
    { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
  ]

  function abilityMod(score: number) {
    const m = Math.floor((score - 10) / 2)
    return m >= 0 ? `+${m}` : `${m}`
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50 overflow-y-auto py-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-stone-800">
          <h3 className="text-lg font-semibold">New Character</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-stone-400 mb-1">Character Name</label>
              <input
                required
                {...field('name')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="Thorin Ironbeard"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Class</label>
              <input
                required
                {...field('className')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="Fighter"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Race</label>
              <input
                required
                {...field('raceName')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="Dwarf"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Background</label>
              <input
                {...field('backgroundName')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="Soldier"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Level</label>
              <input
                type="number" min={1} max={20}
                {...field('level')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Ability scores */}
          <div>
            <p className="text-xs text-stone-400 mb-2">Ability Scores</p>
            <div className="grid grid-cols-6 gap-2">
              {abilityFields.map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <label className="text-xs font-bold text-stone-400">{label}</label>
                  <input
                    type="number" min={1} max={30}
                    {...field(key)}
                    className="w-full px-1 py-1.5 bg-stone-800 border border-stone-600 rounded text-sm text-center focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-amber-400">{abilityMod(form[key] as number)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HP & Combat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-400 mb-1">Max HP</label>
              <input
                type="number" min={0}
                {...field('maxHp')}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setForm((f) => ({ ...f, maxHp: v, currentHp: Math.min(f.currentHp, v) }))
                }}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Current HP</label>
              <input
                type="number" min={0} max={form.maxHp}
                {...field('currentHp')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Armor Class</label>
              <input
                type="number" min={0}
                {...field('armorClass')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Speed (ft)</label>
              <input
                type="number" min={0}
                {...field('speed')}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  const [showCreateChar, setShowCreateChar] = useState(false)

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
            <section className="bg-stone-900 border border-stone-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Characters ({characters.length})</h2>
                <button
                  onClick={() => setShowCreateChar(true)}
                  className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
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
                        onClick={() => navigate(`/characters/${ch.id}`)}
                        className="w-full flex items-center gap-4 p-3 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                          {ch.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{ch.name}</p>
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

            {/* Invite code (DM only) */}
            {isDM && (
              <section className="bg-stone-900 border border-stone-800 rounded-xl p-6">
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
                    className="px-3 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
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
            <section className="bg-stone-900 border border-stone-800 rounded-xl p-6">
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
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
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

      {/* Create character modal */}
      {showCreateChar && id && (
        <CreateCharForm
          campaignId={id}
          onCreated={(char) => {
            setCharacters((prev) => [...prev, char])
            setShowCreateChar(false)
          }}
          onClose={() => setShowCreateChar(false)}
        />
      )}
    </div>
  )
}
