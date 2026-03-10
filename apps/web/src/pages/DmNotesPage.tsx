import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getCampaignNotes, getRevealedNotes, createCampaignNote, patchCampaignNote, deleteCampaignNote, revealNote,
  getCampaignMembers,
  type NoteDetail,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

export function DmNotesPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isDM, setIsDM] = useState(false)
  const [dmNotes, setDmNotes] = useState<NoteDetail[]>([])
  const [revealedNotes, setRevealedNotes] = useState<NoteDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteDetail | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    if (!campaignId) return
    getCampaignMembers(campaignId).then((members) => {
      const myRole = members.find((m) => m.userId === user?.id)?.role
      const dm = myRole === 'dungeon_master'
      setIsDM(dm)

      const promises: Promise<void>[] = [
        getRevealedNotes(campaignId).then(setRevealedNotes),
      ]
      if (dm) {
        promises.push(getCampaignNotes(campaignId).then(setDmNotes))
      }
      return Promise.all(promises)
    }).catch(() => navigate(`/campaigns/${campaignId}`))
      .finally(() => setLoading(false))
  }, [campaignId, user, navigate])

  useEffect(() => {
    if (!campaignId) return
    getRevealedNotes(campaignId, searchQ || undefined).then(setRevealedNotes).catch(() => {})
    if (isDM) {
      getCampaignNotes(campaignId, searchQ || undefined).then(setDmNotes).catch(() => {})
    }
  }, [campaignId, searchQ, isDM])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId) return
    setError(null)
    setSubmitting(true)
    try {
      const note = await createCampaignNote(campaignId, { title: form.title, content: form.content })
      setDmNotes((prev) => [
        { id: note.id, title: note.title, isRevealed: note.isRevealed, campaignId: campaignId!, authorId: user?.id ?? '', characterId: null, content: form.content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...prev,
      ])
      setShowCreate(false)
      setForm({ title: '', content: '' })
    } catch {
      setError('Failed to create note.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId || !editingNote) return
    setError(null)
    setSubmitting(true)
    try {
      const updated = await patchCampaignNote(campaignId, editingNote.id, { title: form.title, content: form.content })
      setDmNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n))
      setEditingNote(null)
    } catch {
      setError('Failed to update note.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    if (!campaignId || !confirm('Delete this note?')) return
    try {
      await deleteCampaignNote(campaignId, noteId)
      setDmNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch {
      // ignore
    }
  }

  async function handleReveal(noteId: string) {
    if (!campaignId) return
    try {
      await revealNote(campaignId, noteId)
      setDmNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, isRevealed: true } : n))
      const revealed = dmNotes.find((n) => n.id === noteId)
      if (revealed) {
        setRevealedNotes((prev) => [{ ...revealed, isRevealed: true }, ...prev])
      }
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
        <h1 className="text-xl font-bold text-amber-400">Notes</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <p className="text-stone-400">Loading…</p>
        ) : (
          <>
            {/* DM Private Notes (DM only) */}
            {isDM && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Private DM Notes</h2>
                  <button
                    onClick={() => { setShowCreate(true); setForm({ title: '', content: '' }); setError(null) }}
                    className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
                  >
                    + New Note
                  </button>
                </div>

                <input
                  type="search"
                  placeholder="Search notes…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />

                {showCreate && (
                  <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
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
                        placeholder="Content…"
                        value={form.content}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        rows={5}
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

                {dmNotes.length === 0 ? (
                  <p className="text-stone-500 text-sm">No private notes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {dmNotes.map((note) => (
                      <li key={note.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                        {editingNote?.id === note.id ? (
                          <div className="p-5">
                            <form onSubmit={handleEdit} className="space-y-3">
                              <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                              />
                              <textarea
                                value={form.content}
                                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                                rows={5}
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 resize-y"
                              />
                              {error && <p className="text-red-400 text-sm">{error}</p>}
                              <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setEditingNote(null)} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg">
                                  {submitting ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm">{note.title}</h3>
                                {note.isRevealed ? (
                                  <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Revealed</span>
                                ) : (
                                  <span className="text-xs bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded">Private</span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {!note.isRevealed && (
                                  <button
                                    onClick={() => handleReveal(note.id)}
                                    className="text-xs text-stone-400 hover:text-green-400 transition-colors"
                                  >
                                    Reveal to Party
                                  </button>
                                )}
                                <button
                                  onClick={() => { setEditingNote(note); setForm({ title: note.title, content: note.content }) }}
                                  className="text-xs text-stone-400 hover:text-amber-400 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(note.id)}
                                  className="text-xs text-stone-400 hover:text-red-400 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {note.content && (
                              <p className="text-sm text-stone-400 whitespace-pre-wrap">{note.content}</p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Revealed Notes (visible to all members) */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Revealed Notes</h2>
              {!isDM && (
                <input
                  type="search"
                  placeholder="Search notes…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              )}
              {revealedNotes.length === 0 ? (
                <p className="text-stone-500 text-sm">No revealed notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {revealedNotes.map((note) => (
                    <li key={note.id} className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-sm">{note.title}</h3>
                        <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Revealed</span>
                      </div>
                      {note.content && (
                        <p className="text-sm text-stone-300 whitespace-pre-wrap">{note.content}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
