import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Flash } from '../../components/Flash'
import {
  adminMarkAllRead,
  adminReplyToClient,
  getAdminClientThreads,
  type AdminClientThreadsResponse,
} from '../../api/generated'

// Markup ported verbatim from the original app/admin/messages/[clientId]/page.tsx.
// startThread / replyToThread both map onto POST /api/admin/clients/{id}/reply
// (no threadId starts a new thread); markAllRead has its own endpoint.
export function AdminMessageThreadPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<AdminClientThreadsResponse | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await getAdminClientThreads({ path: { clientId: clientId! } })
      setData(data ?? null)
    } catch { /* ignore */ }
  }, [clientId])

  useEffect(() => { void load() }, [load])

  if (!data) return null

  const fullName = data.name || data.email || ''
  const threads = data.threads ?? []
  const unread = threads.reduce((n, t) => n + Number(t.unreadForAdmin ?? 0), 0)

  async function onStartThread(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fields = new FormData(form)
    const subject = String(fields.get('subject') || '').trim()
    const body = String(fields.get('body') || '').trim()
    if (!subject || !body) {
      setParams({ err: 'Please fill in both fields' })
      return
    }
    await adminReplyToClient({ path: { id: clientId! }, body: { threadId: null, subject, body } })
    form.reset()
    setParams({ ok: 'New message sent' })
    await load()
  }

  async function onReply(threadId: string, subject: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const body = String(new FormData(form).get('body') || '').trim()
    if (!body) {
      setParams({ err: 'Please enter a reply' })
      return
    }
    await adminReplyToClient({ path: { id: clientId! }, body: { threadId, subject, body } })
    form.reset()
    setParams({ ok: 'Reply sent' })
    await load()
  }

  async function onMarkAllRead() {
    await adminMarkAllRead({ path: { clientId: clientId! } })
    setParams({ ok: 'Marked as read' })
    await load()
  }

  return (
    <>
      <div className="mb-2">
        <Link to="/admin/messages" className="text-sm text-brand-700 hover:underline">← Inbox</Link>
      </div>

      <PageHeader
        title={fullName}
        subtitle={`${data.email}${unread ? ` · ${unread} unread` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/clients/${data.id}`} className="btn-secondary">Client profile</Link>
            {unread > 0 ? (
              <button onClick={onMarkAllRead} className="btn-ghost">Mark all read</button>
            ) : null}
          </div>
        }
      />
      <Flash ok={params.get('ok')} err={params.get('err')} />

      {/* Start a new thread to this client */}
      <section className="card-pad mb-6">
        <h3 className="font-semibold text-navy-900">Start a new conversation with {fullName}</h3>
        <form onSubmit={onStartThread} className="mt-4 space-y-3">
          <div>
            <label className="label">Subject</label>
            <input name="subject" required className="input" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea name="body" rows={4} required className="input" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Send to client</button>
          </div>
        </form>
      </section>

      {/* Threads */}
      <section>
        <h3 className="font-semibold text-navy-900 mb-3">Conversations</h3>
        {threads.length === 0 ? (
          <div className="card-pad">
            <p className="text-sm text-navy-500 italic">No conversations yet.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {threads.map((thread) => (
              <li key={thread.threadId} className="card-pad">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-navy-900 truncate">{thread.subject}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    {Number(thread.unreadForAdmin ?? 0) > 0 ? (
                      <span className="badge-blue">{thread.unreadForAdmin} new</span>
                    ) : null}
                    <span className="text-[11px] text-navy-400">
                      {thread.lastActivityAt ? new Date(thread.lastActivityAt).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {(thread.messages ?? []).map((m) => {
                    const fromClient = m.direction === 'Outbound'
                    return (
                      <li
                        key={m.id}
                        className={`rounded-lg border p-3 ${
                          fromClient
                            ? 'bg-brand-50/50 border-brand-100'
                            : 'bg-white border-navy-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wider text-navy-500">
                              {fromClient ? `From ${fullName}` : 'From You (support)'} ·{' '}
                              {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </div>
                            <div className="text-sm text-navy-700 mt-1 whitespace-pre-wrap">{m.body}</div>
                          </div>
                          {fromClient && !m.adminRead ? (
                            <span className="badge-blue shrink-0">New</span>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Reply */}
                <form
                  onSubmit={(e) => onReply(thread.threadId!, `Re: ${thread.subject}`, e)}
                  className="mt-4 border-t border-navy-100 pt-4 space-y-3"
                >
                  <div>
                    <label className="label">Reply to {fullName}</label>
                    <textarea name="body" rows={3} required className="input" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="btn-primary">Send reply</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
