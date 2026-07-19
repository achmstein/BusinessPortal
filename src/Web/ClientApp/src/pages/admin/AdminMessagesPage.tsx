import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { adminReplyToClient, getAdminMessages } from '../../api/generated'

interface Msg { id: string; direction: string; subject: string; body: string; createdAt: string }
interface Thread { threadId: string; subject: string; messages: Msg[]; lastActivityAt: string; unreadForAdmin: number }
interface ClientThreads { clientId: string; email: string; name: string; threads: Thread[] }

export function AdminMessagesPage() {
  const [data, setData] = useState<ClientThreads[]>([])

  const load = useCallback(async () => {
    try {
      const { data } = await getAdminMessages()
      setData((data as ClientThreads[]) ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void load() }, [load])

  async function onReply(clientId: string, threadId: string, subject: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const body = String(new FormData(form).get('body') || '').trim()
    if (!body) return
    await adminReplyToClient({ path: { id: clientId }, body: { threadId, subject, body } })
    form.reset()
    await load()
  }

  return (
    <>
      <PageHeader title="Messages" subtitle="Shared inbox — every client conversation." />
      {data.length === 0 ? (
        <div className="card-pad text-sm text-navy-500">No conversations.</div>
      ) : (
        <div className="space-y-6">
          {data.map((c) => (
            <div key={c.clientId} className="card-pad">
              <div className="font-semibold text-navy-900">
                {c.name || c.email} <span className="text-navy-400 text-sm font-normal">· {c.email}</span>
              </div>
              <div className="mt-3 space-y-4">
                {c.threads.map((t) => (
                  <div key={t.threadId} className="rounded-lg border border-navy-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-navy-900 truncate">{t.subject}</span>
                      {t.unreadForAdmin > 0 ? <span className="badge-blue">{t.unreadForAdmin} new</span> : null}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {t.messages.map((m) => {
                        const fromClient = m.direction === 'Outbound'
                        return (
                          <li key={m.id} className={`rounded p-2 text-sm ${fromClient ? 'bg-navy-50' : 'bg-brand-50/50'}`}>
                            <div className="text-[11px] uppercase tracking-wider text-navy-500">
                              {fromClient ? 'Client' : 'Support'} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </div>
                            <div className="text-navy-700 whitespace-pre-wrap">{m.body}</div>
                          </li>
                        )
                      })}
                    </ul>
                    <form onSubmit={(e) => onReply(c.clientId, t.threadId, `Re: ${t.subject}`, e)} className="mt-2 flex gap-2">
                      <input name="body" placeholder="Reply…" className="input flex-1" />
                      <button className="btn-primary">Send</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
