import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCustomContent, getCustomEntity, createCustomEntity, patchCustomEntity, deleteCustomEntity,
  type CustomEntitySummary, type CustomEntityDetail, type EntityType,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

type Tab = 'monster' | 'item' | 'rule'

const TAB_LABELS: Record<Tab, string> = { monster: 'Monsters', item: 'Items', rule: 'Rules' }

const TYPE_COLORS: Record<Tab, string> = {
  monster: 'bg-red-500/20 text-red-400',
  item: 'bg-sky-500/20 text-sky-400',
  rule: 'bg-purple-500/20 text-purple-400',
}

// ── Monster fields ────────────────────────────────────────────────────────────

function MonsterForm({
  initial,
  onChange,
}: {
  initial: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
}) {
  const [d, setD] = useState({
    hit_points: Number(initial.hit_points ?? 0),
    challenge_rating: Number(initial.challenge_rating ?? 0),
    armor_class_value: Number((initial.armor_class as Array<{ value?: number }>)?.[0]?.value ?? 10),
    size: String(initial.size ?? ''),
    type: String(initial.type ?? ''),
    alignment: String(initial.alignment ?? ''),
    xp: Number(initial.xp ?? 0),
  })

  function update(key: string, value: string | number) {
    const next = { ...d, [key]: value }
    setD(next)
    onChange({
      hit_points: next.hit_points,
      challenge_rating: next.challenge_rating,
      armor_class: [{ value: next.armor_class_value, type: 'natural' }],
      size: next.size || undefined,
      type: next.type || undefined,
      alignment: next.alignment || undefined,
      xp: next.xp || undefined,
    })
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2">
        <span className="text-xs text-stone-400">HP *</span>
        <input type="number" min={0} value={d.hit_points}
          onChange={e => update('hit_points', Number(e.target.value))}
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">AC *</span>
        <input type="number" min={0} value={d.armor_class_value}
          onChange={e => update('armor_class_value', Number(e.target.value))}
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">CR *</span>
        <input type="number" min={0} step={0.125} value={d.challenge_rating}
          onChange={e => update('challenge_rating', Number(e.target.value))}
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">Size</span>
        <input type="text" value={d.size}
          onChange={e => update('size', e.target.value)}
          placeholder="Medium"
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">Type</span>
        <input type="text" value={d.type}
          onChange={e => update('type', e.target.value)}
          placeholder="humanoid"
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label className="col-span-2">
        <span className="text-xs text-stone-400">Alignment</span>
        <input type="text" value={d.alignment}
          onChange={e => update('alignment', e.target.value)}
          placeholder="chaotic evil"
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">XP</span>
        <input type="number" min={0} value={d.xp}
          onChange={e => update('xp', Number(e.target.value))}
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
    </div>
  )
}

// ── Item fields ────────────────────────────────────────────────────────────────

function ItemForm({
  initial,
  onChange,
}: {
  initial: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
}) {
  const [d, setD] = useState({
    equipment_category: String(initial.equipment_category ?? ''),
    rarity: String(initial.rarity ?? ''),
    requires_attunement: Boolean(initial.requires_attunement ?? false),
    desc: String(Array.isArray(initial.desc) ? (initial.desc as string[]).join('\n') : (initial.desc ?? '')),
  })

  function update(key: string, value: unknown) {
    const next = { ...d, [key]: value }
    setD(next as typeof d)
    onChange({
      equipment_category: next.equipment_category,
      rarity: next.rarity || undefined,
      requires_attunement: next.requires_attunement || undefined,
      desc: next.desc || undefined,
    })
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2">
        <span className="text-xs text-stone-400">Category *</span>
        <input type="text" value={d.equipment_category}
          onChange={e => update('equipment_category', e.target.value)}
          placeholder="Weapon, Armor, Wondrous Item…"
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label>
        <span className="text-xs text-stone-400">Rarity</span>
        <input type="text" value={d.rarity}
          onChange={e => update('rarity', e.target.value)}
          placeholder="rare"
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm" />
      </label>
      <label className="flex items-center gap-2 mt-5">
        <input type="checkbox" checked={d.requires_attunement}
          onChange={e => update('requires_attunement', e.target.checked)}
          className="accent-amber-400" />
        <span className="text-sm">Requires Attunement</span>
      </label>
      <label className="col-span-2">
        <span className="text-xs text-stone-400">Description</span>
        <textarea value={d.desc} rows={3}
          onChange={e => update('desc', e.target.value)}
          className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm resize-y" />
      </label>
    </div>
  )
}

// ── Rule fields ────────────────────────────────────────────────────────────────

function RuleForm({
  initial,
  onChange,
}: {
  initial: Record<string, unknown>
  onChange: (d: Record<string, unknown>) => void
}) {
  const [desc, setDesc] = useState(String(initial.desc ?? ''))

  function update(value: string) {
    setDesc(value)
    onChange({ desc: value })
  }

  return (
    <label className="block">
      <span className="text-xs text-stone-400">Rule text *</span>
      <textarea value={desc} rows={5}
        onChange={e => update(e.target.value)}
        className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm resize-y" />
    </label>
  )
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

function EntityModal({
  campaignId,
  editEntity,
  defaultType,
  onSaved,
  onClose,
}: {
  campaignId: string
  editEntity: CustomEntityDetail | null
  defaultType: Tab
  onSaved: () => void
  onClose: () => void
}) {
  const isEdit = !!editEntity
  const [entityType, setEntityType] = useState<Tab>(editEntity ? editEntity.entityType as Tab : defaultType)
  const [name, setName] = useState(editEntity?.name ?? '')
  const [baseIndex, setBaseIndex] = useState('')
  const [typeData, setTypeData] = useState<Record<string, unknown>>(editEntity?.data ?? {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    setSubmitting(true)
    try {
      if (isEdit) {
        await patchCustomEntity(campaignId, editEntity!.id, { name, data: typeData })
      } else {
        await createCustomEntity(campaignId, {
          entityType,
          name,
          baseIndex: baseIndex.trim() || null,
          data: typeData,
        })
      }
      onSaved()
    } catch (err: unknown) {
      const e2 = err as { body?: { error?: string; detail?: string } }
      setError(e2.body?.detail ?? e2.body?.error ?? 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center px-4 pt-10 z-50 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-lg mb-10">
        <h3 className="text-lg font-semibold mb-4">{isEdit ? 'Edit' : 'Create'} Custom Content</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div>
              <span className="text-xs text-stone-400">Type</span>
              <div className="flex gap-2 mt-1">
                {(['monster', 'item', 'rule'] as Tab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntityType(t)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                      entityType === t ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-stone-400">Name *</span>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Cave Troll"
              className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm"
            />
          </label>

          {!isEdit && entityType !== 'rule' && (
            <label className="block">
              <span className="text-xs text-stone-400">Clone from SRD index (optional)</span>
              <input
                type="text" value={baseIndex} onChange={e => setBaseIndex(e.target.value)}
                placeholder="e.g. goblin"
                className="mt-1 block w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm font-mono"
              />
            </label>
          )}

          <div>
            <span className="text-xs text-stone-400 block mb-2">
              {entityType === 'monster' ? 'Monster stats' : entityType === 'item' ? 'Item details' : 'Rule text'}
            </span>
            {entityType === 'monster' && (
              <MonsterForm initial={typeData} onChange={setTypeData} />
            )}
            {entityType === 'item' && (
              <ItemForm initial={typeData} onChange={setTypeData} />
            )}
            {entityType === 'rule' && (
              <RuleForm initial={typeData} onChange={setTypeData} />
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              {submitting ? '…' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

function EntityDetail({
  campaignId,
  entity,
  isDM,
  onEdit,
  onDeleted,
  onClose,
}: {
  campaignId: string
  entity: CustomEntityDetail
  isDM: boolean
  onEdit: () => void
  onDeleted: () => void
  onClose: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${entity.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteCustomEntity(campaignId, entity.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center px-4 pt-10 z-50 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-6 w-full max-w-lg mb-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[entity.entityType as Tab]}`}>
              {entity.entityType}
            </span>
            <h3 className="text-xl font-semibold mt-1">{entity.name}</h3>
            {entity.baseIndex && (
              <p className="text-xs text-stone-500 mt-0.5">Cloned from: <span className="font-mono">{entity.baseIndex}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-lg">✕</button>
        </div>

        <pre className="bg-stone-800 rounded-lg p-4 text-xs text-stone-300 overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify(entity.data, null, 2)}
        </pre>

        {isDM && (
          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={handleDelete} disabled={deleting}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              {deleting ? '…' : 'Delete'}
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-sm bg-stone-700 hover:bg-stone-600 rounded-lg transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CustomContentPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>('monster')
  const [entities, setEntities] = useState<CustomEntitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isDM, setIsDM] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [detailEntity, setDetailEntity] = useState<CustomEntityDetail | null>(null)
  const [editingEntity, setEditingEntity] = useState<CustomEntityDetail | null>(null)

  async function load() {
    if (!campaignId) return
    setLoading(true)
    try {
      const rows = await getCustomContent(campaignId)
      setEntities(rows)

      // Determine role by checking if user has any entity as creator (approximation)
      // Actually we need to get campaign members — for now get from the campaignMembers
      // The correct approach: we get members from the campaign endpoint
      // We use a simpler heuristic: fetch campaign members
      const membersRes = await fetch(`/api/v1/campaigns/${campaignId}/members`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
      if (membersRes.ok) {
        const members = await membersRes.json() as Array<{ userId: string; role: string }>
        const me = members.find(m => m.userId === user?.id)
        setIsDM(me?.role === 'dungeon_master')
      }
    } catch (err) {
      console.error('Failed to load custom content', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [campaignId])

  async function openDetail(entity: CustomEntitySummary) {
    if (!campaignId) return
    const detail = await getCustomEntity(campaignId, entity.id)
    setDetailEntity(detail)
  }

  const filtered = entities.filter(e => e.entityType === tab)

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">Custom Content</h1>
        {isDM && (
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
          >
            + New
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-stone-900 border border-stone-800 rounded-xl p-1">
          {(['monster', 'item', 'rule'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-stone-700 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
            <p className="text-stone-500 text-sm">
              No custom {TAB_LABELS[tab].toLowerCase()} yet.
              {isDM && ' Click "+ New" to create one.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(entity => (
              <li key={entity.id}>
                <button
                  onClick={() => openDetail(entity)}
                  className="w-full flex items-center gap-3 p-4 bg-stone-900 border border-stone-800 hover:border-stone-600 rounded-xl transition-colors text-left"
                >
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[entity.entityType as Tab]}`}>
                    {entity.entityType}
                  </span>
                  <span className="font-medium flex-1">{entity.name}</span>
                  {entity.baseIndex && (
                    <span className="text-xs text-stone-500 font-mono">
                      based on {entity.baseIndex}
                    </span>
                  )}
                  <span className="text-stone-500">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && campaignId && (
        <EntityModal
          campaignId={campaignId}
          editEntity={null}
          defaultType={tab}
          onSaved={() => { setShowCreate(false); load() }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {detailEntity && campaignId && !editingEntity && (
        <EntityDetail
          campaignId={campaignId}
          entity={detailEntity}
          isDM={isDM}
          onEdit={() => { setEditingEntity(detailEntity); setDetailEntity(null) }}
          onDeleted={() => { setDetailEntity(null); load() }}
          onClose={() => setDetailEntity(null)}
        />
      )}

      {editingEntity && campaignId && (
        <EntityModal
          campaignId={campaignId}
          editEntity={editingEntity}
          defaultType={editingEntity.entityType as Tab}
          onSaved={() => { setEditingEntity(null); load() }}
          onClose={() => setEditingEntity(null)}
        />
      )}
    </div>
  )
}
