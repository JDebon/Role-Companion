import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getLoreDocuments, getLoreDocument, createLoreDocument, patchLoreDocument, deleteLoreDocument,
  getCampaignMembers,
  type LoreDocumentSummary, type LoreDocumentDetail,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

export function LorePage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isDM, setIsDM] = useState(false)
  const [docs, setDocs] = useState<LoreDocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<LoreDocumentDetail | null>(null)
  const [editingDoc, setEditingDoc] = useState<LoreDocumentDetail | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    if (!campaignId) return
    Promise.all([
      getCampaignMembers(campaignId),
      getLoreDocuments(campaignId),
    ]).then(([members, loreDocs]) => {
      const myRole = members.find((m) => m.userId === user?.id)?.role
      setIsDM(myRole === 'dungeon_master')
      setDocs(loreDocs)
    }).catch(() => navigate(`/campaigns/${campaignId}`))
      .finally(() => setLoading(false))
  }, [campaignId, user, navigate])

  useEffect(() => {
    if (!campaignId) return
    getLoreDocuments(campaignId, searchQ || undefined)
      .then(setDocs)
      .catch(() => {})
  }, [campaignId, searchQ])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId) return
    setError(null)
    setSubmitting(true)
    try {
      const doc = await createLoreDocument(campaignId, { title: form.title, content: form.content })
      setDocs((prev) => [...prev, { id: doc.id, title: doc.title, isPublished: doc.isPublished, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])
      setShowCreate(false)
      setForm({ title: '', content: '' })
    } catch {
      setError('Failed to create lore document.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoadDetail(docId: string) {
    if (!campaignId) return
    if (selectedDoc?.id === docId) {
      setSelectedDoc(null)
      return
    }
    try {
      const detail = await getLoreDocument(campaignId, docId)
      setSelectedDoc(detail)
      setEditingDoc(null)
    } catch {
      // ignore
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId || !editingDoc) return
    setError(null)
    setSubmitting(true)
    try {
      const updated = await patchLoreDocument(campaignId, editingDoc.id, { title: form.title, content: form.content })
      setDocs((prev) => prev.map((d) => d.id === updated.id ? { ...d, title: updated.title, updatedAt: updated.updatedAt } : d))
      setSelectedDoc(updated)
      setEditingDoc(null)
    } catch {
      setError('Failed to update lore document.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(docId: string) {
    if (!campaignId || !confirm('Delete this lore document?')) return
    try {
      await deleteLoreDocument(campaignId, docId)
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      if (selectedDoc?.id === docId) setSelectedDoc(null)
      if (editingDoc?.id === docId) setEditingDoc(null)
    } catch {
      // ignore
    }
  }

  async function handleTogglePublish(doc: LoreDocumentSummary) {
    if (!campaignId) return
    try {
      const updated = await patchLoreDocument(campaignId, doc.id, { isPublished: !doc.isPublished })
      setDocs((prev) => prev.map((d) => d.id === updated.id ? { ...d, isPublished: updated.isPublished } : d))
      if (selectedDoc?.id === doc.id) setSelectedDoc((prev) => prev ? { ...prev, isPublished: updated.isPublished } : null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">World Lore</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Toolbar */}
        <div className="flex gap-3">
          <input
            type="search"
            placeholder="Search lore…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
          {isDM && (
            <button
              onClick={() => { setShowCreate(true); setForm({ title: '', content: '' }); setError(null) }}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              + New Document
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && isDM && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">New Lore Document</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                required
              />
              <textarea
                placeholder="Markdown content…"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-y"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-stone-500 text-sm">
            {isDM ? 'No lore documents yet. Create one to start building your world.' : 'No lore documents have been published yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <button
                    onClick={() => handleLoadDetail(doc.id)}
                    className="flex-1 text-left font-medium text-sm hover:text-amber-300 transition-colors"
                  >
                    {doc.title}
                  </button>
                  {isDM && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${doc.isPublished ? 'bg-green-500/20 text-green-400' : 'bg-stone-700 text-stone-400'}`}>
                      {doc.isPublished ? 'Published' : 'Draft'}
                    </span>
                  )}
                  {isDM && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePublish(doc)}
                        className={`text-xs transition-colors ${doc.isPublished ? 'text-stone-400 hover:text-yellow-400' : 'text-stone-400 hover:text-green-400'}`}
                      >
                        {doc.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!campaignId) return
                          const detail = await getLoreDocument(campaignId, doc.id)
                          setEditingDoc(detail)
                          setForm({ title: detail.title, content: detail.content })
                          setSelectedDoc(null)
                          setShowCreate(false)
                        }}
                        className="text-xs text-stone-400 hover:text-amber-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="text-xs text-stone-400 hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  )}
                </div>

                {/* Expanded view */}
                {selectedDoc?.id === doc.id && editingDoc?.id !== doc.id && (
                  <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">{selectedDoc.content || <span className="text-stone-500 italic">No content.</span>}</p>
                  </div>
                )}

                {/* Inline edit form */}
                {editingDoc?.id === doc.id && (
                  <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                    <form onSubmit={handleEdit} className="space-y-3">
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                        required
                      />
                      <textarea
                        value={form.content}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        rows={8}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 resize-y"
                      />
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setEditingDoc(null)} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg">
                          {submitting ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
