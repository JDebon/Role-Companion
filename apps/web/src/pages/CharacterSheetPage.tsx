import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCharacter, patchCharacter, type CharacterSheet,
  getInventory, addInventoryItem, patchInventoryItem, deleteInventoryItem, putCurrency,
  type InventoryResponse, type InventoryItem, type Currency,
  getSpells, addSpell, deleteSpell, putSpellSlots, expendSpellSlot, recoverSpellSlots, putConcentration,
  type SpellsResponse, type SpellEntry,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
}

const SKILL_LABELS: Record<string, string> = {
  acrobatics: 'Acrobatics',
  animal_handling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
}

function signedBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function ProfDot({ level }: { level: 'none' | 'proficient' | 'expertise' }) {
  if (level === 'expertise') return <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" title="Expertise" />
  if (level === 'proficient') return <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" title="Proficient" />
  return <span className="w-3 h-3 rounded-full border border-stone-600 inline-block" title="None" />
}

type Tab = 'sheet' | 'inventory' | 'spells'

const COIN_LABELS: Array<{ key: keyof Currency; label: string; color: string }> = [
  { key: 'pp', label: 'PP', color: 'text-purple-400' },
  { key: 'gp', label: 'GP', color: 'text-amber-400' },
  { key: 'ep', label: 'EP', color: 'text-sky-400' },
  { key: 'sp', label: 'SP', color: 'text-stone-300' },
  { key: 'cp', label: 'CP', color: 'text-orange-400' },
]

export function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [char, setChar] = useState<CharacterSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [hpInput, setHpInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('sheet')

  // Inventory state
  const [inventory, setInventory] = useState<InventoryResponse | null>(null)
  const [invLoading, setInvLoading] = useState(false)
  const [invError, setInvError] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [addMode, setAddMode] = useState<'srd' | 'custom'>('srd')
  const [addSrdIndex, setAddSrdIndex] = useState('')
  const [addCustomName, setAddCustomName] = useState('')
  const [addCustomWeight, setAddCustomWeight] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  const [addError, setAddError] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [currencyDraft, setCurrencyDraft] = useState<Currency>({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
  const [currencySaving, setCurrencySaving] = useState(false)

  // Spells state
  const [spellsData, setSpellsData] = useState<SpellsResponse | null>(null)
  const [spellsLoading, setSpellsLoading] = useState(false)
  const [spellsError, setSpellsError] = useState('')
  const [showAddSpell, setShowAddSpell] = useState(false)
  const [addSpellIndex, setAddSpellIndex] = useState('')
  const [addSpellStatus, setAddSpellStatus] = useState<'known' | 'prepared'>('known')
  const [addSpellError, setAddSpellError] = useState('')
  const [addSpellSubmitting, setAddSpellSubmitting] = useState(false)
  const [editingSlots, setEditingSlots] = useState(false)
  const [slotDraft, setSlotDraft] = useState<Record<number, number>>({})

  const isOwner = char?.userId === user?.id

  useEffect(() => {
    if (!id) return
    getCharacter(id)
      .then(setChar)
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (activeTab !== 'inventory' || !id || inventory) return
    setInvLoading(true)
    setInvError('')
    getInventory(id)
      .then((inv) => {
        setInventory(inv)
        setCurrencyDraft(inv.currency)
      })
      .catch(() => setInvError('Failed to load inventory'))
      .finally(() => setInvLoading(false))
  }, [activeTab, id, inventory])

  async function refreshInventory() {
    if (!id) return
    const inv = await getInventory(id)
    setInventory(inv)
    setCurrencyDraft(inv.currency)
  }

  async function handleAddItem() {
    if (!id) return
    setAddError('')
    setAddSubmitting(true)
    try {
      const qty = parseInt(addQty, 10)
      if (isNaN(qty) || qty < 1) { setAddError('Quantity must be at least 1'); return }
      if (addMode === 'srd') {
        if (!addSrdIndex.trim()) { setAddError('SRD index is required'); return }
        await addInventoryItem(id, { srdEquipmentIndex: addSrdIndex.trim(), quantity: qty, notes: addNotes || undefined })
      } else {
        if (!addCustomName.trim()) { setAddError('Item name is required'); return }
        const weight = addCustomWeight ? parseFloat(addCustomWeight) : undefined
        await addInventoryItem(id, { customName: addCustomName.trim(), customWeight: weight, quantity: qty, notes: addNotes || undefined })
      }
      setShowAddItem(false)
      setAddSrdIndex(''); setAddCustomName(''); setAddCustomWeight(''); setAddQty('1'); setAddNotes('')
      await refreshInventory()
    } catch (err: any) {
      setAddError(err.body?.error === 'ITEM_NOT_FOUND' ? 'SRD item not found' : 'Failed to add item')
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleToggle(item: InventoryItem, field: 'isEquipped' | 'isAttuned') {
    if (!id) return
    try {
      await patchInventoryItem(id, item.id, { [field]: !item[field] })
      await refreshInventory()
    } catch (err: any) {
      if (err.body?.error === 'ATTUNEMENT_SLOTS_FULL') {
        alert('You already have 3 attuned items. Un-attune one first.')
      }
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!id) return
    await deleteInventoryItem(id, itemId)
    await refreshInventory()
  }

  async function handleSaveCurrency() {
    if (!id) return
    setCurrencySaving(true)
    try {
      await putCurrency(id, currencyDraft)
      await refreshInventory()
    } finally {
      setCurrencySaving(false)
    }
  }

  async function applyHpChange(mode: 'damage' | 'heal') {
    if (!char || !hpInput) return
    const amount = parseInt(hpInput, 10)
    if (isNaN(amount) || amount < 0) return

    const newHp = mode === 'damage'
      ? Math.max(0, char.hp.current - amount)
      : Math.min(char.hp.max, char.hp.current + amount)

    setSaving(true)
    try {
      const updated = await patchCharacter(char.id, { currentHp: newHp })
      setChar(updated)
      setHpInput('')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <p className="text-stone-400">Loading…</p>
      </div>
    )
  }

  if (!char) return null

  const hpPercent = char.hp.max > 0 ? (char.hp.current / char.hp.max) * 100 : 0

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${char.campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-amber-400">{char.name}</h1>
          <p className="text-sm text-stone-400">
            {char.className} · {char.raceName} · Level {char.level}
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-stone-800 px-6 flex gap-1">
        {(['sheet', 'inventory'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {invLoading ? (
            <p className="text-stone-400">Loading…</p>
          ) : invError ? (
            <p className="text-red-400 text-sm">{invError}</p>
          ) : inventory ? (
            <>
              {/* Carry weight bar */}
              <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">Carry Weight</h2>
                  <span className="text-sm font-mono text-stone-300">
                    {inventory.carryWeight.toFixed(1)} / {inventory.carryCapacity} lb
                  </span>
                </div>
                <div className="w-full h-2.5 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      inventory.carryWeight / inventory.carryCapacity > 0.9
                        ? 'bg-red-500'
                        : inventory.carryWeight / inventory.carryCapacity > 0.6
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (inventory.carryWeight / inventory.carryCapacity) * 100)}%` }}
                  />
                </div>
              </section>

              {/* Currency */}
              <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-4">Currency</h2>
                <div className="grid grid-cols-5 gap-3">
                  {COIN_LABELS.map(({ key, label, color }) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-bold ${color}`}>{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={currencyDraft[key]}
                        onChange={(e) => setCurrencyDraft((d) => ({ ...d, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={!isOwner}
                        className="w-full px-2 py-1.5 text-center text-sm bg-stone-800 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-60"
                      />
                    </div>
                  ))}
                </div>
                {isOwner && (
                  <button
                    onClick={handleSaveCurrency}
                    disabled={currencySaving}
                    className="mt-3 px-4 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    {currencySaving ? 'Saving…' : 'Save Currency'}
                  </button>
                )}
              </section>

              {/* Item list */}
              <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">
                    Items ({inventory.items.length})
                  </h2>
                  {isOwner && (
                    <button
                      onClick={() => { setShowAddItem(true); setAddError('') }}
                      className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors"
                    >
                      + Add Item
                    </button>
                  )}
                </div>

                {/* Add item form */}
                {showAddItem && (
                  <div className="mb-4 p-4 bg-stone-800 rounded-lg border border-stone-700 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddMode('srd')}
                        className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${addMode === 'srd' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-stone-600 text-stone-400 hover:text-stone-200'}`}
                      >
                        SRD Item
                      </button>
                      <button
                        onClick={() => setAddMode('custom')}
                        className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${addMode === 'custom' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-stone-600 text-stone-400 hover:text-stone-200'}`}
                      >
                        Custom Item
                      </button>
                    </div>

                    {addMode === 'srd' ? (
                      <input
                        type="text"
                        placeholder="SRD index (e.g. longsword)"
                        value={addSrdIndex}
                        onChange={(e) => setAddSrdIndex(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-stone-700 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={addCustomName}
                          onChange={(e) => setAddCustomName(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-stone-700 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          placeholder="Weight (lb)"
                          value={addCustomWeight}
                          onChange={(e) => setAddCustomWeight(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-stone-700 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                        className="w-20 px-3 py-2 text-sm bg-stone-700 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500 text-center"
                      />
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-stone-700 border border-stone-600 rounded-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {addError && <p className="text-xs text-red-400">{addError}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={handleAddItem}
                        disabled={addSubmitting}
                        className="flex-1 py-2 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        {addSubmitting ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        onClick={() => setShowAddItem(false)}
                        className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200 border border-stone-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {inventory.items.length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-6">No items yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {inventory.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 bg-stone-800 rounded-lg px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-sm text-stone-100 truncate">{item.name}</span>
                            <span className="text-xs text-stone-500">×{item.quantity}</span>
                            {item.weight !== null && (
                              <span className="text-xs text-stone-500">{item.weight} lb</span>
                            )}
                            {item.cost && (
                              <span className="text-xs text-amber-400">{item.cost}</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-stone-400 truncate mt-0.5">{item.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => isOwner && handleToggle(item, 'isEquipped')}
                            disabled={!isOwner}
                            title={item.isEquipped ? 'Equipped' : 'Not equipped'}
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${item.isEquipped ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-stone-700 text-stone-500 border border-stone-600'} disabled:cursor-default`}
                          >
                            E
                          </button>
                          <button
                            onClick={() => isOwner && handleToggle(item, 'isAttuned')}
                            disabled={!isOwner}
                            title={item.isAttuned ? 'Attuned' : 'Not attuned'}
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors ${item.isAttuned ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'bg-stone-700 text-stone-500 border border-stone-600'} disabled:cursor-default`}
                          >
                            A
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              title="Remove item"
                              className="w-7 h-7 rounded text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </main>
      )}

      {activeTab === 'sheet' && (
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Top row: Ability scores + Combat stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ability scores */}
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-4">Ability Scores</h2>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(char.abilityScores).map(([key, val]) => (
                <div key={key} className="flex flex-col items-center bg-stone-800 rounded-lg py-3 px-2">
                  <span className="text-xs font-bold text-stone-400 uppercase">{ABILITY_LABELS[key]}</span>
                  <span className="text-2xl font-bold mt-1">{signedBonus(val.modifier)}</span>
                  <span className="text-sm text-stone-400">{val.score}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Combat stats */}
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-2">Combat</h2>

            {/* HP bar */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-stone-400 uppercase font-semibold">Hit Points</span>
                <span className="text-sm font-mono">
                  <span className={char.hp.current === 0 ? 'text-red-400' : 'text-stone-100'}>{char.hp.current}</span>
                  <span className="text-stone-500">/{char.hp.max}</span>
                  {char.hp.temporary > 0 && (
                    <span className="text-sky-400 ml-1">(+{char.hp.temporary} temp)</span>
                  )}
                </span>
              </div>
              <div className="w-full h-3 bg-stone-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              {/* HP controls (owner only) */}
              {isOwner && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={hpInput}
                    onChange={(e) => setHpInput(e.target.value)}
                    placeholder="Amount"
                    className="w-24 px-2 py-1.5 text-sm bg-stone-800 border border-stone-600 rounded-lg text-center focus:outline-none focus:border-amber-500"
                    onKeyDown={(e) => e.key === 'Enter' && applyHpChange('heal')}
                  />
                  <button
                    onClick={() => applyHpChange('damage')}
                    disabled={saving || !hpInput}
                    className="flex-1 px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    Damage
                  </button>
                  <button
                    onClick={() => applyHpChange('heal')}
                    disabled={saving || !hpInput}
                    className="flex-1 px-3 py-1.5 text-sm bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg disabled:opacity-40 transition-colors"
                  >
                    Heal
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-stone-800 rounded-lg py-2">
                <p className="text-xs text-stone-400 uppercase font-semibold">AC</p>
                <p className="text-xl font-bold">{char.armorClass}</p>
              </div>
              <div className="bg-stone-800 rounded-lg py-2">
                <p className="text-xs text-stone-400 uppercase font-semibold">Initiative</p>
                <p className="text-xl font-bold">{signedBonus(char.initiative ?? char.abilityScores.dex.modifier)}</p>
              </div>
              <div className="bg-stone-800 rounded-lg py-2">
                <p className="text-xs text-stone-400 uppercase font-semibold">Speed</p>
                <p className="text-xl font-bold">{char.speed}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-sm">
              <div className="bg-stone-800 rounded-lg py-2">
                <p className="text-xs text-stone-400 uppercase font-semibold">Prof. Bonus</p>
                <p className="text-lg font-bold text-amber-400">{signedBonus(char.proficiencyBonus)}</p>
              </div>
              <div className="bg-stone-800 rounded-lg py-2">
                <p className="text-xs text-stone-400 uppercase font-semibold">Background</p>
                <p className="text-sm font-medium truncate px-1">{char.backgroundName || '—'}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Saving throws + Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Saving throws */}
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-3">Saving Throws</h2>
            <ul className="space-y-1.5">
              {Object.entries(char.savingThrows).map(([key, val]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span className={`w-3 h-3 rounded-full inline-block flex-shrink-0 ${val.proficient ? 'bg-sky-400' : 'border border-stone-600'}`} />
                  <span className="w-20 font-mono text-amber-300 text-xs">{signedBonus(val.bonus)}</span>
                  <span className="text-stone-300">{ABILITY_LABELS[key]}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Skills */}
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-3">Skills</h2>
            <ul className="space-y-1">
              {Object.entries(char.skills).map(([key, val]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <ProfDot level={val.proficiency} />
                  <span className="w-10 font-mono text-amber-300 text-xs">{signedBonus(val.bonus)}</span>
                  <span className="text-stone-300">{SKILL_LABELS[key] ?? key}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Traits & Features */}
        {char.traits.length > 0 && (
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-3">Features & Traits</h2>
            <ul className="space-y-1">
              {char.traits.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-300">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Backstory */}
        {char.backstory && (
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-3">Backstory</h2>
            <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">{char.backstory}</p>
          </section>
        )}
      </main>
      )}
    </div>
  )
}
