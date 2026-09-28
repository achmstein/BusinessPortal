import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import {
  getAsicRenewalsOptions,
  getCompletedRenewalsOptions,
  startThreadMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import { renewalStatus } from '@/lib/renewal'
import { formatDate } from '@/lib/dates'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Menu,
  PageHeader,
  Panel,
  PanelTitle,
  Record,
  RecordList,
  RecordSkeleton,
  Tooltip,
  ValidityBand,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The worklist. Its job is different from the dashboard's ("is anything wrong?")
// and from Business names' ("manage my register"): this is where you act on what
// is due, so the page *is* the list, ordered by urgency.
//
// What changed and why:
//
//  · The three summary tiles are gone. "Due now" counted daysUntil <= 0 and
//    "Overdue" counted < 0, so every overdue registration was counted in both
//    and the two tiles never reconciled. A worklist's length is its own count.
//  · Cancel is no longer a peer of Renew. Cancelling an ASIC registration is
//    irreversible and rare, and it sat one misclick from the primary action; it
//    now lives in a per-row menu, described in full words.
//  · "Request information from ASIC" opened a support conversation rather than
//    contacting ASIC. The control now says what it does.
//  · A duplicate "tracked names" list was really the Business names page.
// ─────────────────────────────────────────────────────────────────────────────

export function AsicRenewalsPage() {
  const renewals = useQuery(getAsicRenewalsOptions())
  const completed = useQuery(getCompletedRenewalsOptions())

  const ask = useMutation({
    ...startThreadMutation(),
    onSuccess: () =>
      toastSuccess('Message sent', 'We’ll check your ASIC records and reply in Messages.'),
    onError: () => toastError('Couldn’t send that message', 'Try again in a moment.'),
  })

  // Most urgent first — an overdue registration outranks one due in a month.
  const items = (renewals.data ?? [])
    .map((item) => ({ item, status: renewalStatus(item.dueDate) }))
    .sort((a, b) => (a.status.days ?? Number.MAX_SAFE_INTEGER) - (b.status.days ?? Number.MAX_SAFE_INTEGER))

  const needing = items.filter(({ status }) => status.needsAction)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Renewals"
        description="Business names and companies with a renewal date coming up."
        actions={
          <Button
            variant="secondary"
            loading={ask.isPending}
            onClick={() =>
              ask.mutate({
                body: {
                  subject: 'Please check my ASIC renewal dates',
                  body: 'Could you check my upcoming ASIC business name and company review dates and update my records?',
                },
              })
            }
          >
            Ask us to check with ASIC
          </Button>
        }
      />

      {renewals.isPending ? (
        <RecordList aria-busy="true">
          <RecordSkeleton />
          <RecordSkeleton />
        </RecordList>
      ) : renewals.isError ? (
        <ErrorState
          description="We couldn’t load your renewal dates just now."
          action={
            <Button variant="secondary" onClick={() => void renewals.refetch()}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing is due"
          description="We’re watching your registrations and will email you well before anything needs renewing."
          action={
            <Button asChild variant="secondary">
              <Link to="/business-names">See your business names</Link>
            </Button>
          }
        />
      ) : (
        <>
          {needing.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Nothing needs renewing yet. These are the dates we’re watching.
            </p>
          ) : null}

          <RecordList>
            {items.map(({ item, status }) => {
              const isBusinessName = item.kind === 'Business Name'
              return (
                <Record key={`${item.kind}-${item.sourceId}`} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-xl leading-tight font-medium text-ink">
                        {item.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-faint">
                        {item.kind}
                        {item.identifier && item.identifier !== '—' ? ` · ${item.identifier}` : ''} · due{' '}
                        {formatDate(item.dueDate)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {status.needsAction ? (
                        <Badge tone={status.tone}>
                          {status.tone === 'overdue'
                            ? `${Math.abs(status.days ?? 0)} days overdue`
                            : `${status.days} days left`}
                        </Badge>
                      ) : (
                        <span className="text-sm text-ink-faint">{status.days} days left</span>
                      )}

                      {isBusinessName ? (
                        <>
                          <Button asChild size="sm" variant={status.needsAction ? 'primary' : 'secondary'}>
                            <Link to={`/asic-renewals/${item.sourceId}/renew`}>Renew</Link>
                          </Button>

                          {/* Cancelling is irreversible, so it sits behind a
                              menu rather than beside the primary action. */}
                          <Menu.Root>
                            <Tooltip label="More options">
                              <Menu.Trigger
                                aria-label={`More options for ${item.name}`}
                                className="p-1.5"
                              >
                                <MoreHorizontal aria-hidden className="size-4" />
                              </Menu.Trigger>
                            </Tooltip>
                            <Menu.Content>
                              <Menu.Item value="manage" asChild>
                                <Link to="/business-names">Edit this business name</Link>
                              </Menu.Item>
                              <Menu.Item value="cancel" tone="danger" asChild>
                                <Link to={`/asic-renewals/${item.sourceId}/cancel`}>
                                  Cancel this registration…
                                </Link>
                              </Menu.Item>
                            </Menu.Content>
                          </Menu.Root>
                        </>
                      ) : (
                        <Button asChild size="sm" variant="secondary">
                          <Link to="/business">Manage</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  <ValidityBand
                    className="mt-3"
                    registeredDate={undefined}
                    renewalDate={item.dueDate}
                    status={status}
                  />
                </Record>
              )
            })}
          </RecordList>
        </>
      )}

      {/* What they've already paid for — renewals used to be announced as
          messages; this is the lasting record. */}
      {completed.data && completed.data.length > 0 ? (
        <Panel className="flex flex-col gap-3">
          <PanelTitle as="h2" className="text-lg">
            Business name renewals completed
          </PanelTitle>
          <ul className="flex flex-col divide-y divide-rule">
            {completed.data.map((renewal) => {
              const years = Number(renewal.years) || 0
              return (
                <li
                  key={renewal.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{renewal.businessName}</p>
                    <p className="text-sm text-ink-faint">
                      Renewed {formatDate(renewal.renewedAt)}
                      {years > 0 ? ` · ${years} year${years === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  {renewal.newRenewalDate ? (
                    <p className="text-sm text-ink-muted">
                      Next due <span data-numeric>{formatDate(renewal.newRenewalDate)}</span>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
