import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getAdminOverviewOptions } from '@/api/generated/@tanstack/react-query.gen'
import { Button, ErrorState, List, Page, PageSkeleton, Panel, TextLink } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Staff open this first thing, and the question is "is there anything waiting
// for me?" — so the page answers that rather than presenting four equal tiles
// and leaving the reader to work out which two are actionable.
//
// Unread messages and renewals falling due are work. Client and thread counts
// are context, and sit below in one quiet line rather than occupying the same
// visual weight as the queue.
// ─────────────────────────────────────────────────────────────────────────────

function QueueItem({
  count,
  singular,
  plural,
  detail,
  to,
  action,
}: {
  count: number
  singular: string
  plural: string
  detail: string
  to: string
  action: string
}) {
  return (
    <List.Row className="justify-between">
      <div className="flex min-w-0 items-baseline gap-3">
        <span data-numeric className="font-display text-3xl leading-none font-medium text-ink">
          {count}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium text-ink">{count === 1 ? singular : plural}</span>
          <span className="text-sm text-ink-faint">{detail}</span>
        </span>
      </div>
      <Button asChild size="sm" variant={count > 0 ? 'primary' : 'secondary'}>
        <Link to={to}>
          {action}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </Button>
    </List.Row>
  )
}

export function AdminOverviewPage() {
  const overview = useQuery(getAdminOverviewOptions())

  if (overview.isPending) {
    return (
      <Page title="Overview">
        <PageSkeleton />
      </Page>
    )
  }

  if (overview.isError) {
    return (
      <Page title="Overview">
        <ErrorState
          description="We couldn’t load the console summary."
          action={
            <Button variant="secondary" onClick={() => void overview.refetch()}>
              Try again
            </Button>
          }
        />
      </Page>
    )
  }

  const unread = Number(overview.data?.unreadMessages ?? 0)
  const renewalsDue = Number(overview.data?.renewalsDue ?? 0)
  const clients = Number(overview.data?.clients ?? 0)
  const threads = Number(overview.data?.activeThreads ?? 0)
  const clear = unread === 0 && renewalsDue === 0

  return (
    <Page
      title={clear ? 'Nothing waiting' : 'Waiting on you'}
      description={
        clear
          ? 'No unread messages, and nothing falling due in the next 30 days.'
          : 'Work through the queues below.'
      }
    >
      <List>
        <QueueItem
          count={unread}
          singular="unread message"
          plural="unread messages"
          detail="From clients, awaiting a reply"
          to="/admin/messages"
          action="Open inbox"
        />
        <QueueItem
          count={renewalsDue}
          singular="renewal due"
          plural="renewals due"
          detail="Business names expiring within 30 days"
          to="/admin/registry"
          action="View registry"
        />
      </List>

      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          <span data-numeric className="text-ink">
            {clients}
          </span>{' '}
          {clients === 1 ? 'client' : 'clients'} ·{' '}
          <span data-numeric className="text-ink">
            {threads}
          </span>{' '}
          {threads === 1 ? 'conversation' : 'conversations'}
        </p>
        <TextLink to="/admin/clients" arrow>
          Browse clients
        </TextLink>
      </Panel>
    </Page>
  )
}
