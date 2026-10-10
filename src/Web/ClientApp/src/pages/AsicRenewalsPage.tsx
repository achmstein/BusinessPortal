import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { buttonClasses } from '@/ui/Button'
import {
  getAsicRenewalsOptions,
  getCompletedRenewalsOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import { renewalStatus } from '@/lib/renewal'
import { formatDate } from '@/lib/dates'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Menu,
  List,
  Page,
  Section,
  Record,
  RecordTitle,
  RecordList,
  RecordSkeleton,
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
//  · "Sync with ASIC" no longer opens a support conversation; it reloads the
//    renewal lists from our records.
//  · A duplicate "tracked names" list was really the Business names page.
// ─────────────────────────────────────────────────────────────────────────────

export function AsicRenewalsPage() {
  const renewals = useQuery(getAsicRenewalsOptions())
  const completed = useQuery(getCompletedRenewalsOptions())
  const inProgress = (completed.data ?? []).filter((r) => r.status !== 'Completed')
  const done = (completed.data ?? []).filter((r) => r.status === 'Completed')
  // Names already paid for and with ASIC — offering "Renew" again invites a double payment.
  const underway = new Set(
    inProgress
      .filter((r) => r.status !== 'Failed')
      .flatMap((r) => [r.businessNameId ?? '', (r.businessName ?? '').trim().toLowerCase()])
      .filter(Boolean),
  )

  const syncing = renewals.isRefetching || completed.isRefetching

  async function sync() {
    const [r, c] = await Promise.all([renewals.refetch(), completed.refetch()])
    if (r.isError || c.isError) toastError('Couldn’t sync just now', 'Try again in a moment.')
    else toastSuccess('Renewal dates up to date')
  }

  // Most urgent first — an overdue registration outranks one due in a month.
  const items = (renewals.data ?? [])
    .map((item) => ({ item, status: renewalStatus(item.dueDate) }))
    .sort((a, b) => (a.status.days ?? Number.MAX_SAFE_INTEGER) - (b.status.days ?? Number.MAX_SAFE_INTEGER))

  const needing = items.filter(({ status }) => status.needsAction)

  return (
    <Page
      title="Renewals"
      actions={
        <Button variant="secondary" loading={syncing} onClick={() => void sync()}>
          Sync with ASIC
        </Button>
      }
    >

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
                      <RecordTitle>
                        {item.name}
                      </RecordTitle>
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
                          {underway.has(item.sourceId ?? '') || underway.has((item.name ?? '').trim().toLowerCase()) ? (
                            <Badge tone="due">Renewal underway</Badge>
                          ) : (
                            <Button asChild size="sm" variant={status.needsAction ? 'primary' : 'secondary'}>
                              <Link to={`/asic-renewals/${item.sourceId}/renew`}>Renew</Link>
                            </Button>
                          )}

                          {/* Cancelling is irreversible, so it sits behind a
                              menu rather than beside the primary action. */}
                          <Menu.Root>
                            <Menu.Trigger
                              aria-label={`Manage ${item.name}`}
                              className={buttonClasses('secondary', 'sm')}
                            >
                              Manage
                              <ChevronDown aria-hidden className="size-4" />
                            </Menu.Trigger>
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
      {/* Paid renewals, mirrored from Renewtron: in progress first, then done. */}
      {inProgress.length > 0 ? (
        <Section title="Renewals in progress" meta={`${inProgress.length}`}>
          <List>
            {inProgress.map((renewal) => (
              <List.Row key={renewal.id} className="justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{renewal.businessName}</p>
                  <p className="text-sm text-ink-faint">
                    Paid {formatDate(renewal.renewedAt)}
                    {Number(renewal.years) > 0 ? ` · ${renewal.years} year${Number(renewal.years) === 1 ? '' : 's'}` : ''}
                    {renewal.statusMessage ? ` · ${renewal.statusMessage}` : ''}
                  </p>
                </div>
                {renewal.status === 'Failed' ? (
                  <Badge tone="overdue">Needs attention</Badge>
                ) : renewal.status === 'Scheduled' ? (
                  <Badge tone="ok">Paid · scheduled</Badge>
                ) : (
                  <Badge tone="due">With ASIC</Badge>
                )}
              </List.Row>
            ))}
          </List>
        </Section>
      ) : null}

      {done.length > 0 ? (
        <Section title="Business name renewals completed" meta={`${done.length}`}>
          <List>
            {done.map((renewal) => {
              const years = Number(renewal.years) || 0
              return (
                <List.Row key={renewal.id} className="justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{renewal.businessName}</p>
                    <p className="text-sm text-ink-faint">
                      Renewed {formatDate(renewal.renewedAt)}
                      {years > 0 ? ` · ${years} year${years === 1 ? '' : 's'}` : ''}
                      {renewal.transactionReference ? (
                        <>
                          {' · ASIC ref '}
                          <span data-numeric>{renewal.transactionReference}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {renewal.newRenewalDate ? (
                    <p className="text-sm text-ink-muted">
                      Next due <span data-numeric>{formatDate(renewal.newRenewalDate)}</span>
                    </p>
                  ) : null}
                </List.Row>
              )
            })}
          </List>
        </Section>
      ) : null}
    </Page>
  )
}
