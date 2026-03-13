import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getEncounter,
  getCampaignCharacters,
  addCombatant,
  startEncounter,
  applyHpDelta,
  nextTurn,
  endEncounter,
  resetEncounter,
  type EncounterDetail,
  type Combatant,
  type CharacterSummary,
} from '../api/client'

// ── Add Combatant Modal ───────────────────────────────────────────────────────

interface AddCombatantModalProps {
  campaignId: string
  encounterId: string
  characters: CharacterSummary[]
  onAdded: (combatants: Combatant[]) => void
  onClose: () => void
}

function AddCombatantModal({ campaignId, encounterId, characters, onAdded, onClose }: AddCombatantModalProps) {
  const [tab, setTab] = useState<'monster' | 'pc'>('monster')
  const [monsterIndex, setMonsterIndex] = useState('')
  const [count, setCount] = useState(1)
  const [selectedCharId, setSelectedCharId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      let result: Combatant[]
      if (tab === 'monster') {
        result = await addCombatant(campaignId, encounterId, {
          type: 'srd_monster',
          monsterIndex: monsterIndex.trim().toLowerCase().replace(/\s+/g, '-'),
          count,
        })
      } else {
        result = await addCombatant(campaignId, encounterId, {
          type: 'player_character',
          characterId: selectedCharId,
        })
      }
      onAdded(result)
      onClose()
    } catch (err: unknown) {
      const e = err as { body?: { error?: string } }
      setError(e.body?.error === 'MONSTER_NOT_FOUND'
        ? 'Monster not found in SRD. Check the index spelling.'
        : 'Failed to add combatant.')
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
        <h3 className="text-lg font-semibold mb-4">Add Combatant</h3>

        <div className="flex gap-1 mb-4 bg-stone-800 p-1 rounded-lg">
          {(['monster', 'pc'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                tab === t ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {t === 'monster' ? 'SRD Monster' : 'Player Character'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'monster' ? (
            <>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Monster Index</label>
                <input
                  required
                  value={monsterIndex}
                  onChange={e => setMonsterIndex(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  placeholder="goblin"
                />
                <p className="text-xs text-stone-500 mt-1">Use the SRD index (e.g. goblin, orc, ancient-red-dragon)</p>
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Count</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs text-stone-400 mb-1">Character</label>
              <select
                required
                value={selectedCharId}
                onChange={e => setSelectedCharId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Select character…</option>
                {characters.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} (Lvl {ch.level} {ch.className})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-crimson-500 hover:bg-crimson-400 disabled:opacity-50 text-white font-semibold rounded-lg"
            >
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Initiative Setup ──────────────────────────────────────────────────────────

interface InitiativeSetupProps {
  combatants: Combatant[]
  onStart: (initiatives: Array<{ combatantId: string; initiative: number }>) => void
  loading: boolean
}

function InitiativeSetup({ combatants, onStart, loading }: InitiativeSetupProps) {
  const [initiatives, setInitiatives] = useState<Record<string, string>>({})

  function handleStart(e: React.FormEvent) {
    e.preventDefault()
    const result = combatants.map(c => ({
      combatantId: c.id,
      initiative: parseInt(initiatives[c.id] ?? '0', 10) || 0,
    }))
    onStart(result)
  }

  return (
    <form onSubmit={handleStart} className="space-y-3">
      <p className="text-sm text-stone-400 mb-2">Enter initiative rolls for each combatant:</p>
      {combatants.map(c => (
        <div key={c.id} className="flex items-center gap-3">
          <span className="flex-1 text-sm">{c.displayName}</span>
          <input
            type="number"
            min={-5}
            max={30}
            value={initiatives[c.id] ?? ''}
            onChange={e => setInitiatives(prev => ({ ...prev, [c.id]: e.target.value }))}
            placeholder="0"
            className="w-20 px-2 py-1.5 bg-stone-800 border border-stone-600 rounded text-sm text-center focus:outline-none focus:border-amber-500"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
      >
        {loading ? 'Starting…' : 'Start Encounter'}
      </button>
    </form>
  )
}

// ── HP Bar ────────────────────────────────────────────────────────────────────

function hpBarColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-green-500'
  if (pct > 0.25) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function EncounterRunnerPage() {
  const { id: campaignId, encId } = useParams<{ id: string; encId: string }>()
  const navigate = useNavigate()

  const [encounter, setEncounter] = useState<EncounterDetail | null>(null)
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCombatant, setShowAddCombatant] = useState(false)
  const [startingEncounter, setStartingEncounter] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [hpInputs, setHpInputs] = useState<Record<string, string>>({})
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!campaignId || !encId) return
    getEncounter(campaignId, encId).then(setEncounter)
  }, [campaignId, encId])

  useEffect(() => {
    if (!campaignId || !encId) return
    Promise.all([
      getEncounter(campaignId, encId),
      getCampaignCharacters(campaignId),
    ])
      .then(([enc, chars]) => {
        setEncounter(enc)
        setCharacters(chars)
      })
      .catch(() => navigate(`/campaigns/${campaignId}/encounters`))
      .finally(() => setLoading(false))
  }, [campaignId, encId, navigate])

  async function handleStart(initiatives: Array<{ combatantId: string; initiative: number }>) {
    if (!campaignId || !encId) return
    setStartingEncounter(true)
    try {
      const updated = await startEncounter(campaignId, encId, initiatives)
      setEncounter(updated)
    } finally {
      setStartingEncounter(false)
    }
  }

  async function handleHpDelta(combatantId: string, delta: number) {
    if (!campaignId || !encId) return
    setActionLoading(true)
    try {
      const result = await applyHpDelta(campaignId, encId, combatantId, delta)
      setEncounter(prev => {
        if (!prev) return prev
        return {
          ...prev,
          combatants: prev.combatants.map(c =>
            c.id === combatantId
              ? { ...c, currentHp: result.currentHp, isUnconscious: result.isUnconscious }
              : c
          ),
        }
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleNextTurn() {
    if (!campaignId || !encId) return
    setActionLoading(true)
    try {
      const result = await nextTurn(campaignId, encId)
      setEncounter(prev => prev ? { ...prev, currentTurnIndex: result.currentTurnIndex, round: result.round } : prev)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEndEncounter() {
    if (!campaignId || !encId) return
    setActionLoading(true)
    try {
      await endEncounter(campaignId, encId)
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReset() {
    if (!campaignId || !encId) return
    setActionLoading(true)
    try {
      await resetEncounter(campaignId, encId)
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !encounter) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <p className="text-stone-400">Loading…</p>
      </div>
    )
  }

  const activeCombatant = encounter.status === 'active'
    ? encounter.combatants[encounter.currentTurnIndex]
    : null

  const selectedCombatant = encounter.combatants.find(c => c.id === selectedCombatantId) ?? encounter.combatants[0] ?? null

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}/encounters`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">{encounter.name}</h1>
        {encounter.status === 'active' && (
          <span className="text-sm text-stone-400">Round {encounter.round}</span>
        )}
        <div className="ml-auto flex gap-2">
          {encounter.status === 'preparing' && (
            <button
              onClick={() => setShowAddCombatant(true)}
              className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 font-semibold rounded-lg transition-colors"
            >
              + Add Combatant
            </button>
          )}
          {encounter.status === 'active' && (
            <>
              <button
                onClick={handleNextTurn}
                disabled={actionLoading}
                className="px-4 py-1.5 text-sm bg-crimson-500 hover:bg-crimson-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
              >
                Next Turn →
              </button>
              <button
                onClick={handleEndEncounter}
                disabled={actionLoading}
                className="px-3 py-1.5 text-sm border border-stone-600 hover:border-stone-400 rounded-lg transition-colors"
              >
                End
              </button>
            </>
          )}
          {(encounter.status === 'preparing' || encounter.status === 'completed') && (
            <button
              onClick={handleReset}
              disabled={actionLoading}
              className="px-3 py-1.5 text-sm border border-stone-600 hover:border-stone-400 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      <main className="flex h-[calc(100vh-65px)]">
        {/* Left panel: Initiative order */}
        <aside className="w-72 border-r border-stone-800 overflow-y-auto">
          {encounter.combatants.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-stone-500 text-sm">No combatants yet.</p>
              {encounter.status === 'preparing' && (
                <button
                  onClick={() => setShowAddCombatant(true)}
                  className="mt-3 px-4 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-semibold rounded-lg"
                >
                  + Add
                </button>
              )}
            </div>
          ) : encounter.status === 'preparing' ? (
            <div className="p-4">
              <p className="text-xs text-stone-400 font-semibold uppercase mb-3">Combatants ({encounter.combatants.length})</p>
              <ul className="space-y-2 mb-6">
                {encounter.combatants.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-sm text-stone-300">
                    <span className="flex-1">{c.displayName}</span>
                    <span className="text-stone-500 text-xs">{c.maxHp} HP · AC {c.armorClass}</span>
                  </li>
                ))}
              </ul>
              <InitiativeSetup
                combatants={encounter.combatants}
                onStart={handleStart}
                loading={startingEncounter}
              />
            </div>
          ) : (
            <ul className="py-2">
              {encounter.combatants.map((c, idx) => {
                const isActive = encounter.status === 'active' && idx === encounter.currentTurnIndex
                const isSelected = c.id === (selectedCombatantId ?? encounter.combatants[0]?.id)
                return (
                  <li
                    key={c.id}
                    onClick={() => setSelectedCombatantId(c.id)}
                    className={`px-4 py-3 cursor-pointer border-l-2 transition-colors ${
                      isActive ? 'border-amber-500 bg-amber-500/10' : 'border-transparent'
                    } ${isSelected && !isActive ? 'bg-stone-800' : ''} ${c.isUnconscious ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {isActive && <span className="text-amber-400 text-xs font-bold">▶</span>}
                      <span className={`text-sm font-medium ${c.isUnconscious ? 'line-through text-stone-500' : ''}`}>
                        {c.displayName}
                      </span>
                      <span className="ml-auto text-xs text-stone-500 font-mono">{c.initiative ?? '?'}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${hpBarColor(c.currentHp, c.maxHp)}`}
                          style={{ width: `${c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-stone-400 font-mono">{c.currentHp}/{c.maxHp}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right panel: Combatant detail + HP controls */}
        <section className="flex-1 p-6 overflow-y-auto">
          {encounter.status === 'active' && activeCombatant && (
            <div className="mb-4 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm font-semibold">
                Active turn: {activeCombatant.displayName}
              </p>
            </div>
          )}

          {encounter.status === 'completed' && (
            <div className="mb-4 px-4 py-2 bg-stone-800 border border-stone-700 rounded-lg">
              <p className="text-stone-400 text-sm">Encounter completed.</p>
            </div>
          )}

          {selectedCombatant && encounter.status !== 'preparing' && (
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-bold ${selectedCombatant.isUnconscious ? 'line-through text-stone-500' : ''}`}>
                    {selectedCombatant.displayName}
                  </h2>
                  {selectedCombatant.isUnconscious && (
                    <span className="text-xs text-red-400 font-semibold">UNCONSCIOUS</span>
                  )}
                  <p className="text-stone-400 text-sm capitalize mt-1">{selectedCombatant.type.replace('_', ' ')}</p>
                </div>
                <div className="text-right text-sm text-stone-400">
                  <p>AC {selectedCombatant.armorClass}</p>
                  <p>Initiative {selectedCombatant.initiative ?? '—'}</p>
                </div>
              </div>

              {/* HP bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-stone-400">HP</span>
                  <span className="text-lg font-bold font-mono">
                    {selectedCombatant.currentHp} / {selectedCombatant.maxHp}
                  </span>
                </div>
                <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${hpBarColor(selectedCombatant.currentHp, selectedCombatant.maxHp)}`}
                    style={{
                      width: `${selectedCombatant.maxHp > 0 ? (selectedCombatant.currentHp / selectedCombatant.maxHp) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* HP controls */}
              {encounter.status === 'active' && (
                <div>
                  <p className="text-xs text-stone-400 mb-2">Apply damage / healing</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={hpInputs[selectedCombatant.id] ?? ''}
                      onChange={e => setHpInputs(prev => ({ ...prev, [selectedCombatant.id]: e.target.value }))}
                      placeholder="Amount"
                      className="w-28 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      disabled={actionLoading}
                      onClick={() => {
                        const amt = parseInt(hpInputs[selectedCombatant.id] ?? '0', 10) || 0
                        handleHpDelta(selectedCombatant.id, -amt)
                        setHpInputs(prev => ({ ...prev, [selectedCombatant.id]: '' }))
                      }}
                      className="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 font-semibold text-sm rounded-lg disabled:opacity-50 transition-colors"
                    >
                      Damage
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => {
                        const amt = parseInt(hpInputs[selectedCombatant.id] ?? '0', 10) || 0
                        handleHpDelta(selectedCombatant.id, amt)
                        setHpInputs(prev => ({ ...prev, [selectedCombatant.id]: '' }))
                      }}
                      className="px-3 py-2 bg-green-600/30 hover:bg-green-600/50 text-green-400 font-semibold text-sm rounded-lg disabled:opacity-50 transition-colors"
                    >
                      Heal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {showAddCombatant && campaignId && encId && (
        <AddCombatantModal
          campaignId={campaignId}
          encounterId={encId}
          characters={characters}
          onAdded={newCombatants => {
            setEncounter(prev => prev ? {
              ...prev,
              combatants: [...prev.combatants, ...newCombatants],
            } : prev)
          }}
          onClose={() => setShowAddCombatant(false)}
        />
      )}
    </div>
  )
}
