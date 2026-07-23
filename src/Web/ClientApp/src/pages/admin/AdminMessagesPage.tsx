import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { getAdminMessages } from '../../api/generated'

interface Msg { id: string; direction: string; subject: string; body: string; createdAt: string }
interface Thread { threadId: string; subject: string; messages: Msg[]; lastActivityAt: string; unreadForAdmin: number }
interface ClientThreads { clientId: string; email: string; name: string; threads: Thread[] }

interface Row {
  userId: string
  userName: string
  userEmail: string
  lastMessage: { subject: string; body: string; createdAt: string; direction: string }
  unread: number
}

// Markup ported verbatim from the original app/admin/messages/page.tsx — the
// inbox list; each row opens the per-client thread page.
export function AdminMessagesPage() {
  const [data, setData] = useState<ClientThreads[]>([])

  useEffect(() => {
    getAdminMessages()
      .then(({ data }) => setData((data as ClientThreads[]) ?? []))
      .catch(() => setData([]))
  }, [])

  const rows: Row[] = data
    .filter((c) => c.threads.some((t) => t.messages.length > 0))
    .map((c) => {
      const all = c.threads.flatMap((t) => t.messages)
      const sorted = [...all].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      const last = sorted[0]
      return {
        userId: c.clientId,
        userName: c.name || c.email,
        userEmail: c.email,
        lastMessage: {
          subject: last.subject,
          body: last.body,
          createdAt: last.createdAt,
          direction: last.direction,
        },
        unread: c.threads.reduce((n, t) => n + t.unreadForAdmin, 0),
      }
    })
    .sort((a, b) => {
      // unread first, then by most recent
      if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    })

  const totalUnread = rows.reduce((n, r) => n + r.unread, 0)

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={`${rows.length} thread${rows.length === 1 ? '' : 's'} · ${totalUnread} unread`}
      />

      {rows.length === 0 ? (
        <div className="card-pad">
          <p className="text-sm text-navy-500 italic">No client messages yet.</p>
        </div>
      ) : (
        <div className="card-pad">
          <ul className="divide-y divide-navy-100">
            {rows.map((r) => (
              <li key={r.userId}>
                <Link
                  to={`/admin/messages/${r.userId}`}
                  className="block py-3 -mx-2 px-2 rounded hover:bg-navy-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy-900 truncate">{r.userName}</span>
                        <span className="text-xs text-navy-500 truncate">{r.userEmail}</span>
                        {r.unread > 0 ? <span className="badge-blue">{r.unread} new</span> : null}
                      </div>
                      <div className="mt-0.5 text-sm text-navy-700 truncate">
                        <span className="text-navy-400">
                          {r.lastMessage.direction === 'Outbound' ? 'Client:' : 'You:'}{' '}
                        </span>
                        {r.lastMessage.subject}
                      </div>
                      <div className="text-xs text-navy-500 truncate">{r.lastMessage.body}</div>
                    </div>
                    <div className="text-[11px] text-navy-400 shrink-0">
                      {new Date(r.lastMessage.createdAt).toLocaleString()}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
