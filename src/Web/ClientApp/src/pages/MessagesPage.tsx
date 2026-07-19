import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  getMessageThreads,
  markThreadRead,
  replyToThread,
  startThread,
  type ThreadDto,
} from '../api/generated'

export function MessagesPage() {
  const [threads, setThreads] = useState<ThreadDto[]>([])
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await getMessageThreads()
      setThreads(data ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalUnread = threads.reduce((n, t) => n + (Number(t.unreadForClient) || 0), 0)

  async function onStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const subject = String(f.get('subject') || '').trim()
    const body = String(f.get('body') || '').trim()
    if (!subject || !body) { setFlash({ tone: 'err', text: 'Please fill in both fields' }); return }
    await startThread({ body: { subject, body } })
    form.reset()
    setFlash({ tone: 'ok', text: 'Message sent to support' })
    await load()
  }

  async function onReply(threadId: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const body = String(new FormData(form).get('body') || '').trim()
    if (!body) { setFlash({ tone: 'err', text: 'Please enter a reply' }); return }
    await replyToThread({ path: { threadId }, body: { body } })
    form.reset()
    setFlash({ tone: 'ok', text: 'Reply sent' })
    await load()
  }

  async function onMarkRead(threadId: string) {
    await markThreadRead({ path: { threadId } })
    await load()
  }

  async function onMarkAllRead() {
    await Promise.all(
      threads.filter((t) => Number(t.unreadForClient) > 0 && t.threadId).map((t) => markThreadRead({ path: { threadId: t.threadId! } })),
    )
    setFlash({ tone: 'ok', text: 'All messages marked as read' })
    await load()
  }

  return (
    <>
      <PageHeader
        title="Messages & Support"
        subtitle="Conversations with our support team. Reply to any message to keep the thread going."
        actions={totalUnread > 0 ? (
          <button className="btn-secondary" onClick={onMarkAllRead}>Mark all read</button>
        ) : undefined}
      />

      {flash ? (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${flash.tone === 'ok' ? 'bg-accent-50 border-accent-200 text-accent-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {flash.text}
        </div>
      ) : null}

      {/* Start a new thread */}
      <section className="card-pad">
        <h3 className="font-semibold text-navy-900">Start a new conversation</h3>
        <form onSubmit={onStart} className="mt-4 space-y-3">
          <div>
            <label className="label">Subject</label>
            <input name="subject" required className="input" placeholder="What can we help with?" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea name="body" rows={4} required className="input" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Send to support</button>
          </div>
        </form>
      </section>

      {/* Threads */}
      <section className="mt-6">
        {threads.length === 0 ? (
          <div className="card-pad">
            <p className="text-sm text-navy-500 italic">No conversations yet.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {threads.map((thread) => (
              <li key={thread.threadId} id={`thread-${thread.threadId}`} className="card-pad scroll-mt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-navy-900 truncate">{thread.subject}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {Number(thread.unreadForClient) > 0 ? (
                      <span className="badge-blue">{thread.unreadForClient} new</span>
                    ) : null}
                    <span className="text-[11px] text-navy-400">
                      {thread.lastActivityAt ? new Date(thread.lastActivityAt).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {(thread.messages ?? []).map((m) => {
                    const fromSupport = m.direction === 'Inbound'
                    return (
                      <li key={m.id} className={`rounded-lg border p-3 ${fromSupport ? 'bg-brand-50/50 border-brand-100' : 'bg-white border-navy-100'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wider text-navy-500">
                              {fromSupport ? 'Support' : 'You'} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </div>
                            <div className="text-sm text-navy-700 mt-1 whitespace-pre-wrap">{m.body}</div>
                          </div>
                          {fromSupport && !m.read ? (
                            <button className="badge-blue cursor-pointer" onClick={() => thread.threadId && onMarkRead(thread.threadId)}>
                              New · mark read
                            </button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Reply form */}
                <form onSubmit={(e) => thread.threadId && onReply(thread.threadId, e)} className="mt-4 border-t border-navy-100 pt-4 space-y-3">
                  <div>
                    <label className="label">Reply</label>
                    <textarea name="body" rows={3} required className="input" placeholder="Type your reply…" />
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
