import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCampaignMembers,
  getCampaignCharacters,
  createCharacter,
  regenerateInvite,
  removeMember,
  getCompendiumList,
  getCompendiumClassDetail,
  getCompendiumRaceDetail,
  getCompendiumBackgroundDetail,
  type Member,
  type CharacterSummary,
  type CreateCharacterInput,
  type CompendiumEntry,
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

  // SRD option lists
  const [srdClasses, setSrdClasses] = useState<CompendiumEntry[]>([])
  const [srdRaces, setSrdRaces] = useState<CompendiumEntry[]>([])
  const [srdBackgrounds, setSrdBackgrounds] = useState<CompendiumEntry[]>([])

  // Proficiency state populated from SRD
  const [skillProficiencies, setSkillProficiencies] = useState<Record<string, 'none' | 'proficient' | 'expertise'>>({})
  const [savingThrowProficiencies, setSavingThrowProficiencies] = useState<Record<string, boolean>>({})
  const [classSkillChoices, setClassSkillChoices] = useState<{ choose: number; options: string[] } | null>(null)

  // Race bonus tracking for reversal
  const [appliedRaceBonuses, setAppliedRaceBonuses] = useState<Record<string, number>>({})

  useEffect(() => {
    Promise.all([
      getCompendiumList('classes', 100),
      getCompendiumList('races', 100),
      getCompendiumList('backgrounds', 100),
    ]).then(([cls, rcs, bgs]) => {
      setSrdClasses(cls.data)
      setSrdRaces(rcs.data)
      setSrdBackgrounds(bgs.data)
    }).catch(() => {})
  }, [])

  async function handleClassChange(index: string, name: string) {
    setForm((f) => ({ ...f, className: name }))
    if (!index) { setSavingThrowProficiencies({}); setClassSkillChoices(null); return }
    try {
      const detail = await getCompendiumClassDetail(index)
      // Auto-populate saving throws
      const stProfs: Record<string, boolean> = {}
      for (const st of detail.data.saving_throws ?? []) {
        stProfs[st.index] = true
      }
      setSavingThrowProficiencies(stProfs)
      // Build skill proficiency choice picker
      const choice = detail.data.proficiency_choices?.[0]
      if (choice) {
        const opts = choice.from.options
          .map((o) => o.item.index.replace('skill-', ''))
          .filter(Boolean)
        setClassSkillChoices({ choose: choice.choose, options: opts })
        // Clear previously-set class skill profs
        setSkillProficiencies((prev) => {
          const next = { ...prev }
          for (const opt of opts) delete next[opt]
          return next
        })
      } else {
        setClassSkillChoices(null)
      }
    } catch {
      // If fetch fails, leave fields blank for manual input
    }
  }

  async function handleRaceChange(index: string, name: string) {
    setForm((f) => {
      // Reverse previous race bonuses
      const reverted = { ...f }
      for (const [key, bonus] of Object.entries(appliedRaceBonuses)) {
        const k = key as keyof typeof reverted
        if (typeof reverted[k] === 'number') {
          (reverted as Record<string, number>)[key] = (reverted[k] as number) - bonus
        }
      }
      return { ...reverted, raceName: name }
    })
    setAppliedRaceBonuses({})
    if (!index) return
    try {
      const detail = await getCompendiumRaceDetail(index)
      const bonuses: Record<string, number> = {}
      for (const ab of detail.data.ability_bonuses ?? []) {
        bonuses[ab.ability_score.index] = ab.bonus
      }
      setAppliedRaceBonuses(bonuses)
      setForm((f) => {
        const next = { ...f }
        for (const [key, bonus] of Object.entries(bonuses)) {
          const k = key as keyof typeof next
          if (typeof next[k] === 'number') {
            (next as Record<string, number>)[key] = Math.max(1, Math.min(30, (next[k] as number) + bonus))
          }
        }
        if (detail.data.speed) next.speed = detail.data.speed
        return next
      })
    } catch {
      // leave fields as-is
    }
  }

  async function handleBackgroundChange(index: string, name: string) {
    setForm((f) => ({ ...f, backgroundName: name }))
    if (!index) return
    try {
      const detail = await getCompendiumBackgroundDetail(index)
      const profNames = (detail.data.starting_proficiencies ?? [])
        .map((p) => p.index.replace('skill-', ''))
        .filter(Boolean)
      setSkillProficiencies((prev) => {
        const next = { ...prev }
        for (const skill of profNames) next[skill] = 'proficient'
        return next
      })
    } catch {
      // leave as-is
    }
  }

  function toggleClassSkill(skill: string) {
    if (!classSkillChoices) return
    setSkillProficiencies((prev) => {
      const currentChosen = classSkillChoices.options.filter((s) => prev[s] === 'proficient')
      if (prev[skill] === 'proficient') {
        const next = { ...prev }
        delete next[skill]
        return next
      }
      if (currentChosen.length >= classSkillChoices.choose) return prev
      return { ...prev, [skill]: 'proficient' }
    })
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
      const data: CreateCharacterInput = {
        ...form,
        skillProficiencies: Object.keys(skillProficiencies).length > 0 ? skillProficiencies : undefined,
        savingThrowProficiencies: Object.keys(savingThrowProficiencies).length > 0 ? savingThrowProficiencies : undefined,
      }
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

  const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
  const abilityLabels: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }

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
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="Thorin Ironbeard"
              />
            </div>

            {/* Class — SRD dropdown with free-text fallback */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Class</label>
              {srdClasses.length > 0 ? (
                <select
                  required
                  value={srdClasses.find((c) => c.name === form.className)?.index ?? '__custom__'}
                  onChange={(e) => {
                    const idx = e.target.value
                    if (idx === '__custom__') { handleClassChange('', form.className); return }
                    const entry = srdClasses.find((c) => c.index === idx)
                    if (entry) handleClassChange(entry.index, entry.name)
                  }}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">— Select Class —</option>
                  <optgroup label="SRD">
                    {srdClasses.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="__custom__">Custom (type below)</option>
                  </optgroup>
                </select>
              ) : null}
              {(srdClasses.length === 0 || !srdClasses.find((c) => c.name === form.className)) && (
                <input
                  required={srdClasses.length === 0}
                  value={form.className}
                  onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  placeholder={srdClasses.length > 0 ? 'Homebrew class name…' : 'Fighter'}
                />
              )}
            </div>

            {/* Race — SRD dropdown with free-text fallback */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Race</label>
              {srdRaces.length > 0 ? (
                <select
                  required
                  value={srdRaces.find((r) => r.name === form.raceName)?.index ?? '__custom__'}
                  onChange={(e) => {
                    const idx = e.target.value
                    if (idx === '__custom__') { handleRaceChange('', form.raceName); return }
                    const entry = srdRaces.find((r) => r.index === idx)
                    if (entry) handleRaceChange(entry.index, entry.name)
                  }}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">— Select Race —</option>
                  <optgroup label="SRD">
                    {srdRaces.map((r) => <option key={r.index} value={r.index}>{r.name}</option>)}
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="__custom__">Custom (type below)</option>
                  </optgroup>
                </select>
              ) : null}
              {(srdRaces.length === 0 || !srdRaces.find((r) => r.name === form.raceName)) && (
                <input
                  required={srdRaces.length === 0}
                  value={form.raceName}
                  onChange={(e) => setForm((f) => ({ ...f, raceName: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  placeholder={srdRaces.length > 0 ? 'Homebrew race name…' : 'Dwarf'}
                />
              )}
            </div>

            {/* Background — SRD dropdown with free-text fallback */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Background</label>
              {srdBackgrounds.length > 0 ? (
                <select
                  value={srdBackgrounds.find((b) => b.name === form.backgroundName)?.index ?? '__custom__'}
                  onChange={(e) => {
                    const idx = e.target.value
                    if (idx === '__custom__') { handleBackgroundChange('', form.backgroundName); return }
                    const entry = srdBackgrounds.find((b) => b.index === idx)
                    if (entry) handleBackgroundChange(entry.index, entry.name)
                  }}
                  className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">— Select Background —</option>
                  <optgroup label="SRD">
                    {srdBackgrounds.map((b) => <option key={b.index} value={b.index}>{b.name}</option>)}
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="__custom__">Custom (type below)</option>
                  </optgroup>
                </select>
              ) : null}
              {(srdBackgrounds.length === 0 || !srdBackgrounds.find((b) => b.name === form.backgroundName)) && (
                <input
                  value={form.backgroundName}
                  onChange={(e) => setForm((f) => ({ ...f, backgroundName: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  placeholder={srdBackgrounds.length > 0 ? 'Homebrew background name…' : 'Soldier'}
                />
              )}
            </div>

            <div>
              <label className="block text-xs text-stone-400 mb-1">Level</label>
              <input
                type="number" min={1} max={20}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Skill proficiency choice picker (shown when class has choices) */}
          {classSkillChoices && (
            <div className="bg-stone-800 border border-stone-700 rounded-lg p-3">
              <p className="text-xs text-stone-400 mb-2">
                Class Skills: Choose {classSkillChoices.choose} from the list
                <span className="text-stone-500 ml-1">
                  ({classSkillChoices.options.filter((s) => skillProficiencies[s] === 'proficient').length}/{classSkillChoices.choose} chosen)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {classSkillChoices.options.map((skill) => {
                  const chosen = skillProficiencies[skill] === 'proficient'
                  const chosenCount = classSkillChoices.options.filter((s) => skillProficiencies[s] === 'proficient').length
                  const disabled = !chosen && chosenCount >= classSkillChoices.choose
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleClassSkill(skill)}
                      disabled={disabled}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        chosen
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : disabled
                          ? 'border-stone-700 text-stone-600 cursor-not-allowed'
                          : 'border-stone-600 text-stone-400 hover:text-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {skill.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Saving throws auto-populated from class */}
          {Object.keys(savingThrowProficiencies).length > 0 && (
            <div className="bg-stone-800 border border-stone-700 rounded-lg p-3">
              <p className="text-xs text-stone-400 mb-2">Saving Throw Proficiencies (from class)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(savingThrowProficiencies).filter(([, v]) => v).map(([key]) => (
                  <span key={key} className="text-xs px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300 uppercase">
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ability scores */}
          <div>
            <p className="text-xs text-stone-400 mb-2">Ability Scores
              {Object.keys(appliedRaceBonuses).length > 0 && (
                <span className="text-stone-500 ml-1">(racial bonuses applied)</span>
              )}
            </p>
            <div className="grid grid-cols-6 gap-2">
              {abilityKeys.map((key) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <label className="text-xs font-bold text-stone-400">{abilityLabels[key]}</label>
                  <input
                    type="number" min={1} max={30}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                    className="w-full px-1 py-1.5 bg-stone-800 border border-stone-600 rounded text-sm text-center focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-amber-400">{abilityMod(form[key])}</span>
                  {appliedRaceBonuses[key] ? (
                    <span className="text-[10px] text-green-400">+{appliedRaceBonuses[key]}</span>
                  ) : null}
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
                value={form.maxHp}
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
                value={form.currentHp}
                onChange={(e) => setForm((f) => ({ ...f, currentHp: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Armor Class</label>
              <input
                type="number" min={0}
                value={form.armorClass}
                onChange={(e) => setForm((f) => ({ ...f, armorClass: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Speed (ft)</label>
              <input
                type="number" min={0}
                value={form.speed}
                onChange={(e) => setForm((f) => ({ ...f, speed: Number(e.target.value) }))}
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
              className="px-5 py-2 text-sm bg-crimson-500 hover:bg-crimson-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
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
            <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Characters ({characters.length})</h2>
                <button
                  onClick={() => setShowCreateChar(true)}
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
