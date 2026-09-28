import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAdminMessagesOptions } from '@/api/generated/@tanstack/react-query.gen'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Avatar, Button, EmptyState, ErrorState, List, Page, PageSkeleton, Section } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The shared inbox. One question: who is waiting on a reply?
//
// So the answer is the heading, and the rows that need something are separated
// from the rows that don't rather than being one undifferentiated list with a
// badge somewhere in each. Within each group, most recent first.
//
// The preview says who spoke last, because a thread where we replied last is
// waiting on the client, not on us — the same row otherwise looks identical.
// ─────────────────────────────────────────────────────────────────────────────

interface AdminMessage {
  id: string
  direction: string
  subject: string
  body: string
  createdAt: string
}

interface AdminThread {
  threadId: string
  subject: string
  messages: AdminMessage[]
  lastActivityAt: string
  unreadForAdmin: number
}

interface ClientThreads {
  clientId: string
  email: string
  name: string
  threads: AdminThread[]
}

interface Row {
  clientId: string
  name: string
  email: string
  unread: number
  last: AdminMessage
}

function InboxRow({ row }: { row: Row }) {
  const fromClient = row.last.direction === 'Outbound'
  return (
    <List.Row className="p-0 sm:p-0">
      <Link
        to={`/admin/messages/${row.clientId}`}
        className="flex w-full items-start gap-3 px-5 py-4 first:rounded-t-xl last:rounded-b-xl hover:bg-surface-sunken/60 sm:px-6"
      >
        {/* The dot marks unread; the avatar identifies who. Keeping both, with
            the dot overlaid, avoids a third column of chrome per row. */}
        <span className="relative shrink-0">
          <Avatar name={row.name} email={row.email} size="sm" />
          {row.unread > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent-600 ring-2 ring-surface"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn('truncate', row.unread > 0 ? 'font-medium text-ink' : 'text-ink-muted')}>
              {row.name || row.email}
            </span>
            <span className="truncate text-xs text-ink-faint">{row.email}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-muted">{row.last.subject}</span>
          <span className="mt-0.5 block truncate text-sm text-ink-faint">
            {fromClient ? 'They wrote' : 'You replied'}: {row.last.body}
          </span>
        </span>
        <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(row.last.createdAt)}</span>
      </Link>
    </List.Row>
  )
}

export function AdminMessagesPage() {
  const inbox = useQuery({
    ...getAdminMessagesOptions(),
    select: (data) => (data as unknown as ClientThreads[]) ?? [],
  })

  if (inbox.isPending) {
    return (
      <Page title="Messages">
        <PageSkeleton />
      </Page>
    )
  }

  if (inbox.isError) {
    return (
      <Page title="Messages">
        <ErrorState
          description="We couldn’t load the inbox."
          action={
            <Button variant="secondary" onClick={() => void inbox.refetch()}>
              Try again
            </Button>
          }
        />
      </Page>
    )
  }

  const rows: Row[] = (inbox.data ?? [])
    .map((client) => {
      const messages = client.threads.flatMap((thread) => thread.messages)
      if (messages.length === 0) return null
      const last = [...messages].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
      return {
        clientId: client.clientId,
        name: client.name,
        email: client.email,
        unread: client.threads.reduce((n, t) => n + Number(t.unreadForAdmin ?? 0), 0),
        last,
      }
    })
    .filter((row): row is Row => row !== null)
    .sort((a, b) => (b.last.createdAt ?? '').localeCompare(a.last.createdAt ?? ''))

  const waiting = rows.filter((row) => row.unread > 0)
  const settled = rows.filter((row) => row.unread === 0)

  return (
    <Page
      title={waiting.length === 0 ? 'Inbox clear' : `${waiting.length} waiting on a reply`}
      description={
        rows.length === 0
          ? 'Conversations with clients.'
          : `${rows.length} ${rows.length === 1 ? 'client' : 'clients'} with conversations.`
      }
    >

      {rows.length === 0 ? (
        <EmptyState
          title="No client messages yet"
          description="Conversations started from the client portal land here."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {waiting.length > 0 ? (
            <Section title="Waiting on a reply" meta={waiting.length}>
              <List>
                {waiting.map((row) => (
                  <InboxRow key={row.clientId} row={row} />
                ))}
              </List>
            </Section>
          ) : null}

          {settled.length > 0 ? (
            <Section title={waiting.length > 0 ? 'Nothing outstanding' : 'All conversations'}>
              <List>
                {settled.map((row) => (
                  <InboxRow key={row.clientId} row={row} />
                ))}
              </List>
            </Section>
          ) : null}
        </div>
      )}
    </Page>
  )
}
