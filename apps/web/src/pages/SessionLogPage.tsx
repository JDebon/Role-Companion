import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSessionLogs, getSessionLog, createSessionLog, patchSessionLog, deleteSessionLog, pinSessionLog,
  type SessionLogSummary, type SessionLogDetail,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getCampaignMembers } from '../api/client'

export function SessionLogPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [logs, setLogs] = useState<SessionLogSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isDM, setIsDM] = useState(false)
  const [selectedLog, setSelectedLog] = useState<SessionLogDetail | null>(null)
  const [editingLog, setEditingLog] = useState<SessionLogDetail | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ sessionNumber: '', title: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    if (!campaignId) return
    Promise.all([
      getCampaignMembers(campaignId),
      getSessionLogs(campaignId),
    ]).then(([members, sessionLogs]) => {
      const myRole = members.find((m) => m.userId === user?.id)?.role
      setIsDM(myRole === 'dungeon_master')
      setLogs(sessionLogs)
    }).catch(() => navigate(`/campaigns/${campaignId}`))
      .finally(() => setLoading(false))
  }, [campaignId, user, navigate])

  useEffect(() => {
    if (!campaignId) return
    getSessionLogs(campaignId, searchQ || undefined)
      .then(setLogs)
      .catch(() => {})
  }, [campaignId, searchQ])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId) return
    setError(null)
    setSubmitting(true)
    try {
      const log = await createSessionLog(campaignId, {
        sessionNumber: Number(form.sessionNumber),
        title: form.title,
        content: form.content,
      })
      setLogs((prev) => [{ id: log.id, sessionNumber: log.sessionNumber, title: log.title, isPinned: log.isPinned, createdAt: log.createdAt }, ...prev].sort((a, b) => b.sessionNumber - a.sessionNumber))
      setShowCreate(false)
      setForm({ sessionNumber: '', title: '', content: '' })
    } catch (err: unknown) {
      const apiErr = err as { body?: { error?: string } }
      setError(apiErr?.body?.error === 'DUPLICATE_SESSION_NUMBER' ? 'Session number already exists.' : 'Failed to create session log.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoadDetail(logId: string) {
    if (!campaignId) return
    if (selectedLog?.id === logId) {
      setSelectedLog(null)
      return
    }
    try {
      const detail = await getSessionLog(campaignId, logId)
      setSelectedLog(detail)
      setEditingLog(null)
    } catch {
      // ignore
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!campaignId || !editingLog) return
    setError(null)
    setSubmitting(true)
    try {
      const updated = await patchSessionLog(campaignId, editingLog.id, { title: form.title, content: form.content })
      setLogs((prev) => prev.map((l) => l.id === updated.id ? { ...l, title: updated.title } : l))
      setSelectedLog(updated)
      setEditingLog(null)
    } catch {
      setError('Failed to update session log.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(logId: string) {
    if (!campaignId || !confirm('Delete this session log?')) return
    try {
      await deleteSessionLog(campaignId, logId)
      setLogs((prev) => prev.filter((l) => l.id !== logId))
      if (selectedLog?.id === logId) setSelectedLog(null)
      if (editingLog?.id === logId) setEditingLog(null)
    } catch {
      // ignore
    }
  }

  async function handlePin(logId: string) {
    if (!campaignId) return
    try {
      await pinSessionLog(campaignId, logId)
      setLogs((prev) => prev.map((l) => ({ ...l, isPinned: l.id === logId })))
    } catch {
      // ignore
    }
  }

  const pinnedLog = logs.find((l) => l.isPinned)
  const unpinnedLogs = logs.filter((l) => !l.isPinned)

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          Back
        </button>
        <h1 className="text-xl font-bold text-amber-400">Session Logs</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Toolbar */}
        <div className="flex gap-3">
          <input
            type="search"
            placeholder="Search logs…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
          {isDM && (
            <button
              onClick={() => { setShowCreate(true); setForm({ sessionNumber: '', title: '', content: '' }); setError(null) }}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
            >
              + New Log
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && isDM && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">New Session Log</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Session #"
                  value={form.sessionNumber}
                  onChange={(e) => setForm((f) => ({ ...f, sessionNumber: e.target.value }))}
                  className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  min="1"
                  required
                />
                <input
                  type="text"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <textarea
                placeholder="Session recap…"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
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
        ) : (
          <>
            {/* Pinned log at top */}
            {pinnedLog && (
              <div className="bg-stone-900 border border-amber-500/40 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="text-xs bg-amber-500/20 text-amber-400 font-semibold px-2 py-0.5 rounded">Last Session Recap</span>
                  <button
                    onClick={() => handleLoadDetail(pinnedLog.id)}
                    className="flex-1 text-left font-semibold hover:text-amber-300 transition-colors"
                  >
                    Session {pinnedLog.sessionNumber}: {pinnedLog.title}
                  </button>
                  {isDM && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!campaignId) return
                          const detail = await getSessionLog(campaignId, pinnedLog.id)
                          setEditingLog(detail)
                          setForm({ sessionNumber: String(detail.sessionNumber), title: detail.title, content: detail.content })
                          setSelectedLog(null)
                          setShowCreate(false)
                        }}
                        className="text-xs text-stone-400 hover:text-amber-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(pinnedLog.id)} className="text-xs text-stone-400 hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  )}
                </div>
                {selectedLog?.id === pinnedLog.id && editingLog?.id !== pinnedLog.id && (
                  <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">{selectedLog.content || <span className="text-stone-500 italic">No content.</span>}</p>
                  </div>
                )}
                {editingLog?.id === pinnedLog.id && (
                  <div className="px-5 pb-5 border-t border-stone-800 pt-4">
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
                        rows={6}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 resize-y"
                      />
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setEditingLog(null)} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
                        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg">
                          {submitting ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* All other logs */}
            {unpinnedLogs.length === 0 && !pinnedLog && (
              <p className="text-stone-500 text-sm">No session logs yet.</p>
            )}
            <ul className="space-y-2">
              {unpinnedLogs.map((log) => (
                <li key={log.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <span className="text-stone-500 text-sm font-mono w-10 flex-shrink-0">#{log.sessionNumber}</span>
                    <button
                      onClick={() => handleLoadDetail(log.id)}
                      className="flex-1 text-left text-sm font-medium hover:text-amber-300 transition-colors"
                    >
                      {log.title}
                    </button>
                    {isDM && (
                      <div className="flex gap-2">
                        <button onClick={() => handlePin(log.id)} className="text-xs text-stone-400 hover:text-amber-400 transition-colors">Pin</button>
                        <button
                          onClick={async () => {
                            if (!campaignId) return
                            const detail = await getSessionLog(campaignId, log.id)
                            setEditingLog(detail)
                            setForm({ sessionNumber: String(detail.sessionNumber), title: detail.title, content: detail.content })
                            setSelectedLog(null)
                            setShowCreate(false)
                          }}
                          className="text-xs text-stone-400 hover:text-amber-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDelete(log.id)} className="text-xs text-stone-400 hover:text-red-400 transition-colors">Delete</button>
                      </div>
                    )}
                  </div>
                  {selectedLog?.id === log.id && editingLog?.id !== log.id && (
                    <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                      <p className="text-sm text-stone-300 whitespace-pre-wrap">{selectedLog.content || <span className="text-stone-500 italic">No content.</span>}</p>
                    </div>
                  )}
                  {editingLog?.id === log.id && (
                    <div className="px-5 pb-5 border-t border-stone-800 pt-4">
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
                          rows={6}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 resize-y"
                        />
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setEditingLog(null)} className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200">Cancel</button>
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
          </>
        )}
      </main>
    </div>
  )
}
