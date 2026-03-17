import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getCharacter,
  createCharacter,
  patchCharacter,
  getCharacterOptions,
  getCompendiumClassDetail,
  getCompendiumRaceDetail,
  getCompendiumBackgroundDetail,
  type CharacterOptionsResponse,
} from '../api/client'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

type OptionSource = 'srd' | 'custom'
interface SelectedOption {
  value: string // 'srd:barbarian' or 'custom:uuid'
  name: string
  source: OptionSource
  baseIndex: string | null
}

function MergedSelect({
  options,
  value,
  onChange,
  loading,
  error,
  placeholder,
}: {
  options: CharacterOptionsResponse | null
  value: string
  onChange: (opt: SelectedOption | null) => void
  loading: boolean
  error: boolean
  placeholder: string
}) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) { onChange(null); return }
    const [source, ...rest] = val.split(':')
    const key = rest.join(':')
    if (source === 'srd') {
      const entry = options?.srd.find((s) => s.index === key)
      if (entry) onChange({ value: val, name: entry.name, source: 'srd', baseIndex: null })
    } else if (source === 'custom') {
      const entry = options?.custom.find((c) => c.id === key)
      if (entry) onChange({ value: val, name: entry.name, source: 'custom', baseIndex: entry.baseIndex ?? null })
    }
  }

  if (loading) {
    return (
      <select disabled className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm text-stone-500">
        <option>Loading…</option>
      </select>
    )
  }

  if (error) {
    return (
      <select disabled className="w-full px-3 py-2 bg-stone-800 border border-red-500/50 rounded-lg text-sm text-red-400">
        <option>Failed to load options</option>
      </select>
    )
  }

  const hasAny = (options?.srd.length ?? 0) > 0 || (options?.custom.length ?? 0) > 0

  if (!hasAny) {
    return (
      <select disabled className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm text-stone-500">
        <option>No options available</option>
      </select>
    )
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm text-stone-100 focus:outline-none focus:border-amber-500"
    >
      <option value="">{placeholder}</option>
      {(options?.srd.length ?? 0) > 0 && (
        <optgroup label="SRD">
          {options!.srd.map((s) => (
            <option key={s.index} value={`srd:${s.index}`}>{s.name}</option>
          ))}
        </optgroup>
      )}
      {(options?.custom.length ?? 0) > 0 && (
        <optgroup label="Custom">
          {options!.custom.map((c) => (
            <option key={c.id} value={`custom:${c.id}`}>{c.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export function CharacterCreationPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft')

  // Options state
  const [classOptions, setClassOptions] = useState<CharacterOptionsResponse | null>(null)
  const [raceOptions, setRaceOptions] = useState<CharacterOptionsResponse | null>(null)
  const [backgroundOptions, setBackgroundOptions] = useState<CharacterOptionsResponse | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<{ class?: boolean; race?: boolean; background?: boolean }>({})

  // Form state
  const [form, setForm] = useState({
    name: '',
    level: 1,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    maxHp: 10, armorClass: 10, speed: 30,
    backstory: '',
  })

  // Identity selections
  const [selectedClass, setSelectedClass] = useState<SelectedOption | null>(null)
  const [selectedRace, setSelectedRace] = useState<SelectedOption | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<SelectedOption | null>(null)

  // Auto-population state
  const [classSkillChoices, setClassSkillChoices] = useState<{ choose: number; options: string[] } | null>(null)
  const [appliedRaceBonuses, setAppliedRaceBonuses] = useState<Record<string, number>>({})
  const [selectedClassSkills, setSelectedClassSkills] = useState<string[]>([])
  const [autoBackgroundSkills, setAutoBackgroundSkills] = useState<string[]>([])
  const [savingThrowProficiencies, setSavingThrowProficiencies] = useState<Record<string, boolean>>({
    str: false, dex: false, con: false, int: false, wis: false, cha: false,
  })

  // Traits
  const [traits, setTraits] = useState<string[]>([])
  const [newTrait, setNewTrait] = useState('')

  // Names from loaded draft, used to match options once they load
  const [draftNames, setDraftNames] = useState<{ className: string; raceName: string; backgroundName: string } | null>(null)

  // Save state
  const [characterId, setCharacterId] = useState<string | null>(draftId)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // Load options
  useEffect(() => {
    if (!campaignId) return
    setOptionsLoading(true)
    const errors: { class?: boolean; race?: boolean; background?: boolean } = {}

    Promise.allSettled([
      getCharacterOptions(campaignId, 'class'),
      getCharacterOptions(campaignId, 'race'),
      getCharacterOptions(campaignId, 'background'),
    ]).then(([cls, rcs, bgs]) => {
      if (cls.status === 'fulfilled') setClassOptions(cls.value)
      else errors.class = true
      if (rcs.status === 'fulfilled') setRaceOptions(rcs.value)
      else errors.race = true
      if (bgs.status === 'fulfilled') setBackgroundOptions(bgs.value)
      else errors.background = true
      setOptionsError(errors)
      setOptionsLoading(false)
    })
  }, [campaignId])

  // Load draft if ?draft=id
  useEffect(() => {
    if (!draftId) return
    getCharacter(draftId)
      .then((char) => {
        setForm({
          name: char.name,
          level: char.level,
          str: char.abilityScores.str.score,
          dex: char.abilityScores.dex.score,
          con: char.abilityScores.con.score,
          int: char.abilityScores.int.score,
          wis: char.abilityScores.wis.score,
          cha: char.abilityScores.cha.score,
          maxHp: char.hp.max,
          armorClass: char.armorClass,
          speed: char.speed,
          backstory: char.backstory ?? '',
        })
        setSavingThrowProficiencies(
          Object.fromEntries(Object.entries(char.savingThrows).map(([k, v]) => [k, v.proficient]))
        )
        // Load skill proficiencies from draft
        const bgSkills = Object.entries(char.skills)
          .filter(([, v]) => v.proficiency === 'proficient')
          .map(([k]) => k)
        setAutoBackgroundSkills(bgSkills)
        setTraits(char.traits ?? [])
        setDraftNames({ className: char.className, raceName: char.raceName, backgroundName: char.backgroundName })
      })
      .catch(() => {
        // Draft not found or access denied; continue with blank form
      })
  }, [draftId])

  // Once both options and draft names are available, pre-select the dropdowns
  useEffect(() => {
    if (!draftNames || optionsLoading) return

    const matchOption = (
      options: CharacterOptionsResponse | null,
      name: string,
    ): SelectedOption | null => {
      const srd = options?.srd.find((s) => s.name === name)
      if (srd) return { value: `srd:${srd.index}`, name: srd.name, source: 'srd', baseIndex: null }
      const custom = options?.custom.find((c) => c.name === name)
      if (custom) return { value: `custom:${custom.id}`, name: custom.name, source: 'custom', baseIndex: custom.baseIndex ?? null }
      return null
    }

    const cls = matchOption(classOptions, draftNames.className)
    if (cls) setSelectedClass(cls)

    const race = matchOption(raceOptions, draftNames.raceName)
    if (race) setSelectedRace(race)

    const bg = matchOption(backgroundOptions, draftNames.backgroundName)
    if (bg) setSelectedBackground(bg)
  }, [draftNames, optionsLoading, classOptions, raceOptions, backgroundOptions])

  async function handleClassChange(opt: SelectedOption | null) {
    // Reset class-derived state
    setSavingThrowProficiencies({ str: false, dex: false, con: false, int: false, wis: false, cha: false })
    setClassSkillChoices(null)
    setSelectedClassSkills([])
    setSelectedClass(opt)

    if (!opt) return

    const indexToFetch = opt.source === 'srd' ? opt.value.split(':')[1] : opt.baseIndex ?? null
    if (!indexToFetch) return

    try {
      const detail = await getCompendiumClassDetail(indexToFetch)
      const stProfs: Record<string, boolean> = { str: false, dex: false, con: false, int: false, wis: false, cha: false }
      for (const st of detail.data.saving_throws ?? []) {
        stProfs[st.index] = true
      }
      setSavingThrowProficiencies(stProfs)

      const choice = detail.data.proficiency_choices?.[0]
      if (choice) {
        const opts = choice.from.options
          .map((o) => o.item.index.replace('skill-', ''))
          .filter(Boolean)
        setClassSkillChoices({ choose: choice.choose, options: opts })
      }
    } catch {
      showToast("Could not load class defaults — fill manually")
    }
  }

  async function handleRaceChange(opt: SelectedOption | null) {
    // Reverse previous race bonuses
    if (Object.keys(appliedRaceBonuses).length > 0) {
      setForm((f) => {
        const next = { ...f }
        for (const [key, bonus] of Object.entries(appliedRaceBonuses)) {
          const k = key as keyof typeof next
          if (typeof next[k] === 'number') {
            (next as Record<string, number>)[key] = (next[k] as number) - bonus
          }
        }
        return next
      })
      setAppliedRaceBonuses({})
    }

    setSelectedRace(opt)

    if (!opt) return

    const indexToFetch = opt.source === 'srd' ? opt.value.split(':')[1] : opt.baseIndex ?? null
    if (!indexToFetch) return

    try {
      const detail = await getCompendiumRaceDetail(indexToFetch)
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
      showToast("Could not load race defaults — fill manually")
    }
  }

  async function handleBackgroundChange(opt: SelectedOption | null) {
    // Remove previously auto-applied background skills
    setAutoBackgroundSkills([])
    setSelectedBackground(opt)

    if (!opt) return

    const indexToFetch = opt.source === 'srd' ? opt.value.split(':')[1] : opt.baseIndex ?? null
    if (!indexToFetch) return

    try {
      const detail = await getCompendiumBackgroundDetail(indexToFetch)
      const bgSkills = (detail.data.starting_proficiencies ?? [])
        .map((p) => p.index.replace('skill-', ''))
        .filter(Boolean)
      setAutoBackgroundSkills(bgSkills)
    } catch {
      showToast("Could not load background defaults — fill manually")
    }
  }

  function toggleClassSkill(skill: string) {
    if (!classSkillChoices) return
    setSelectedClassSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill)
      if (prev.length >= classSkillChoices.choose) return prev
      return [...prev, skill]
    })
  }

  function toggleSavingThrow(ability: string) {
    setSavingThrowProficiencies((prev) => ({ ...prev, [ability]: !prev[ability] }))
  }

  function buildPayload(status: 'draft' | 'complete') {
    const skillProficiencies: Record<string, 'none' | 'proficient' | 'expertise'> = {}
    for (const skill of selectedClassSkills) skillProficiencies[skill] = 'proficient'
    for (const skill of autoBackgroundSkills) skillProficiencies[skill] = 'proficient'

    return {
      name: form.name,
      className: selectedClass?.name ?? '',
      raceName: selectedRace?.name ?? '',
      backgroundName: selectedBackground?.name ?? '',
      level: form.level,
      str: form.str,
      dex: form.dex,
      con: form.con,
      int: form.int,
      wis: form.wis,
      cha: form.cha,
      maxHp: form.maxHp,
      currentHp: form.maxHp,
      armorClass: form.armorClass,
      speed: form.speed,
      skillProficiencies,
      savingThrowProficiencies,
      backstory: form.backstory || undefined,
      traits,
      status,
    }
  }

  async function handleSaveDraft() {
    if (!campaignId) return
    setSaveError(null)
    setSaving(true)
    try {
      if (!characterId) {
        const payload = buildPayload('draft')
        // Need at least a name for a draft
        if (!payload.name) {
          setSaveError('Enter a name before saving')
          return
        }
        // Use placeholder values if empty for draft
        const draftPayload = {
          ...payload,
          className: payload.className || 'Unknown',
          raceName: payload.raceName || 'Unknown',
        }
        const char = await createCharacter(campaignId, draftPayload)
        setCharacterId(char.id)
        // Update URL to include draft id without page reload
        window.history.replaceState(null, '', `?draft=${char.id}`)
      } else {
        const payload = buildPayload('draft')
        await patchCharacter(characterId, {
          name: payload.name || undefined,
          className: payload.className || undefined,
          raceName: payload.raceName || undefined,
          backgroundName: payload.backgroundName || undefined,
          level: payload.level,
          str: payload.str, dex: payload.dex, con: payload.con,
          int: payload.int, wis: payload.wis, cha: payload.cha,
          maxHp: payload.maxHp, currentHp: payload.currentHp,
          armorClass: payload.armorClass, speed: payload.speed,
          skillProficiencies: payload.skillProficiencies,
          savingThrowProficiencies: payload.savingThrowProficiencies,
          backstory: payload.backstory ?? null,
          traits: payload.traits,
        })
      }
      showToast('Draft saved')
    } catch {
      setSaveError('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const canComplete =
    form.name.trim().length > 0 &&
    !!selectedClass &&
    !!selectedRace &&
    !!selectedBackground &&
    form.maxHp > 0 &&
    (!classSkillChoices || selectedClassSkills.length >= classSkillChoices.choose)

  async function handleComplete() {
    if (!campaignId || !canComplete) return
    setCompleting(true)
    setSaveError(null)
    try {
      const payload = buildPayload('complete')
      let finalId = characterId
      if (!finalId) {
        const char = await createCharacter(campaignId, payload)
        finalId = char.id
      } else {
        await patchCharacter(characterId!, {
          ...payload,
          status: 'complete',
        })
      }
      navigate(`/characters/${finalId}`)
    } catch {
      setSaveError('Failed to complete character. Check all fields.')
    } finally {
      setCompleting(false)
    }
  }

  const allAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-amber-400">New Character</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm border border-stone-600 hover:border-stone-400 text-stone-300 hover:text-stone-100 rounded-lg transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            onClick={handleComplete}
            disabled={completing || !canComplete}
            title={!canComplete ? 'Fill name, class, race, background, max HP, and class skills first' : undefined}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {completing ? 'Completing…' : 'Complete Character'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
            {saveError}
          </div>
        )}

        {toast && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg px-4 py-3 text-sm">
            {toast}
          </div>
        )}

        {/* Identity card */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Identity</h2>

          {/* Name */}
          <div>
            <label className="block text-xs text-stone-400 mb-1">Character Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="Thorin Ironbeard"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Class */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Class *</label>
              <MergedSelect
                options={classOptions}
                value={selectedClass?.value ?? ''}
                onChange={handleClassChange}
                loading={optionsLoading}
                error={!!optionsError.class}
                placeholder="— Select Class —"
              />
            </div>

            {/* Race */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Race *</label>
              <MergedSelect
                options={raceOptions}
                value={selectedRace?.value ?? ''}
                onChange={handleRaceChange}
                loading={optionsLoading}
                error={!!optionsError.race}
                placeholder="— Select Race —"
              />
            </div>

            {/* Background */}
            <div>
              <label className="block text-xs text-stone-400 mb-1">Background *</label>
              <MergedSelect
                options={backgroundOptions}
                value={selectedBackground?.value ?? ''}
                onChange={handleBackgroundChange}
                loading={optionsLoading}
                error={!!optionsError.background}
                placeholder="— Select Background —"
              />
            </div>

            {/* Level */}
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
        </section>

        {/* Ability Scores */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
            Ability Scores
            {Object.keys(appliedRaceBonuses).length > 0 && (
              <span className="text-stone-500 ml-2 normal-case font-normal">(racial bonuses applied)</span>
            )}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {ABILITY_KEYS.map((key) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <label className="text-xs font-bold text-stone-400">{ABILITY_LABELS[key]}</label>
                <input
                  type="number" min={1} max={30}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-1 py-2 bg-stone-800 border border-stone-600 rounded text-sm text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-amber-400 font-mono">{abilityMod(form[key])}</span>
                {appliedRaceBonuses[key] ? (
                  <span className="text-[10px] text-green-400">+{appliedRaceBonuses[key]}</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Combat Stats */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">Combat Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-stone-400 mb-1">Max HP *</label>
              <input
                type="number" min={1}
                value={form.maxHp}
                onChange={(e) => setForm((f) => ({ ...f, maxHp: Number(e.target.value) }))}
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
        </section>

        {/* Saving Throws */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Saving Throws
            {selectedClass && <span className="text-stone-500 ml-2 normal-case font-normal">(auto-set from class)</span>}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {allAbilities.map((ab) => (
              <button
                key={ab}
                type="button"
                onClick={() => toggleSavingThrow(ab)}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold uppercase transition-colors ${
                  savingThrowProficiencies[ab]
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'border-stone-600 text-stone-500 hover:text-stone-300'
                }`}
              >
                {ab}
              </button>
            ))}
          </div>
        </section>

        {/* Skill Proficiencies */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Skill Proficiencies</h2>

          {classSkillChoices && (
            <div>
              <p className="text-xs text-stone-400 mb-2">
                Class Skills: Choose {classSkillChoices.choose}
                <span className="text-stone-500 ml-1">
                  ({selectedClassSkills.length}/{classSkillChoices.choose} chosen)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {classSkillChoices.options.map((skill) => {
                  const chosen = selectedClassSkills.includes(skill)
                  const maxed = !chosen && selectedClassSkills.length >= classSkillChoices.choose
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleClassSkill(skill)}
                      disabled={maxed}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        chosen
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : maxed
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

          {autoBackgroundSkills.length > 0 && (
            <div>
              <p className="text-xs text-stone-400 mb-2">Background Skills (auto-applied)</p>
              <div className="flex flex-wrap gap-1.5">
                {autoBackgroundSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300"
                  >
                    {skill.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!classSkillChoices && autoBackgroundSkills.length === 0 && (
            <p className="text-stone-500 text-xs">Select a class and background to auto-fill proficiencies.</p>
          )}
        </section>

        {/* Traits */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Traits</h2>
          {traits.length > 0 && (
            <ul className="space-y-1">
              {traits.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-stone-300">
                  <span className="flex-1">{t}</span>
                  <button
                    type="button"
                    onClick={() => setTraits((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-stone-500 hover:text-red-400 text-xs transition-colors"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTrait.trim()) {
                  setTraits((prev) => [...prev, newTrait.trim()])
                  setNewTrait('')
                }
              }}
              className="flex-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="Add trait (press Enter)"
            />
            <button
              type="button"
              onClick={() => {
                if (newTrait.trim()) {
                  setTraits((prev) => [...prev, newTrait.trim()])
                  setNewTrait('')
                }
              }}
              className="px-3 py-2 text-sm border border-stone-600 rounded-lg hover:border-stone-400 transition-colors"
            >
              Add
            </button>
          </div>
        </section>

        {/* Backstory */}
        <section className="bg-stone-900 border border-stone-700 rounded-xl p-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Backstory</h2>
          <textarea
            value={form.backstory}
            onChange={(e) => setForm((f) => ({ ...f, backstory: e.target.value }))}
            rows={5}
            className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm focus:outline-none focus:border-amber-500 resize-y"
            placeholder="Your character's history…"
          />
        </section>

        {/* Bottom action bar */}
        <div className="flex justify-end gap-3 pt-2 pb-8">
          <button
            onClick={handleSaveDraft}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2.5 text-sm border border-stone-600 hover:border-stone-400 text-stone-300 hover:text-stone-100 rounded-lg transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            onClick={handleComplete}
            disabled={completing || !canComplete}
            className="px-5 py-2.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {completing ? 'Completing…' : 'Complete Character'}
          </button>
        </div>
      </main>
    </div>
  )
}
