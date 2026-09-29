import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import {
  getAdminOverviewOptions,
  getAdminOverviewQueryKey,
  resendPendingWelcomeEmailsMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import {
  Button,
  ErrorState,
  List,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  TextLink,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Staff open this first thing, and the question is "is there anything waiting
// for me?" — so the page answers that rather than presenting four equal tiles
// and leaving the reader to work out which two are actionable.
//
// Unread messages and renewals falling due are work. Client and thread counts
// are context, and sit below in one quiet line rather than occupying the same
// visual weight as the queue.
//
// Email health sits above everything when it's broken: a revoked provider key
// once meant weeks of welcome and renewal emails silently going nowhere.
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
  const queryClient = useQueryClient()

  const resendPending = useMutation({
    ...resendPendingWelcomeEmailsMutation(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: getAdminOverviewQueryKey() })
      if (result.stoppedBecause) toastError(`Sent ${result.sent} before stopping`, result.stoppedBecause)
      else toastSuccess(`Sent ${result.sent} welcome ${Number(result.sent) === 1 ? 'email' : 'emails'}`)
    },
    onError: () => toastError('Couldn’t send the welcome emails', 'Try again in a moment.'),
  })

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
  const emailFailures = Number(overview.data?.emailFailures24h ?? 0)
  const welcomePending = Number(overview.data?.welcomePending ?? 0)

  return (
    <Page
      title={clear ? 'Nothing waiting' : 'Waiting on you'}
      description={
        clear
          ? 'No unread messages, and nothing falling due in the next 30 days.'
          : 'Work through the queues below.'
      }
    >
      {emailFailures > 0 ? (
        <Panel className="flex flex-col gap-2 border-danger-100 bg-danger-50/60" role="alert">
          <div className="flex items-center gap-2 text-danger-700">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            <PanelTitle className="text-danger-700">
              {emailFailures} {emailFailures === 1 ? 'email' : 'emails'} failed in the last 24 hours
            </PanelTitle>
          </div>
          <p className="text-sm text-danger-700">
            Clients aren’t receiving welcome or password emails. Check the email provider key in{' '}
            <TextLink to="/admin/settings" className="text-danger-700 underline">
              Integrations
            </TextLink>
            .
          </p>
          {overview.data?.lastEmailError ? (
            <p className="text-xs break-words text-danger-600">Last error: {overview.data.lastEmailError}</p>
          ) : null}
        </Panel>
      ) : null}

      {welcomePending > 0 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {welcomePending} new {welcomePending === 1 ? 'client hasn’t' : 'clients haven’t'} received a welcome email
            </p>
            <p className="text-sm text-ink-faint">
              Their accounts were created from Renewtron, but the email didn’t go out.
            </p>
          </div>
          <Button size="sm" loading={resendPending.isPending} onClick={() => resendPending.mutate({})}>
            Send welcome emails
          </Button>
        </Panel>
      ) : null}

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
