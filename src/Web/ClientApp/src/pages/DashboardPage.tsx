import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  getAsicRenewalsOptions,
  getBusinessNamesOptions,
  getMessageThreadsOptions,
  getProfileOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import { renewalStatus } from '@/lib/renewal'
import { formatDate } from '@/lib/dates'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Panel,
  PanelTitle,
  Record,
  RecordList,
  RecordSkeleton,
  Skeleton,
  ValidityBand,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// People reach this page once or twice a year, usually straight from a renewal
// email, and they arrive with exactly one question: do I need to do anything?
//
// So the page answers it in the first line, in words. What replaced what:
//
//  · A time-of-day greeting — the same information as a clock.
//  · A "compliance health" scorecard marking five things ✓ or ✗, including ATO
//    connection, which most customers legitimately never need. Grading someone
//    on obligations they didn't ask for is the wrong tone for a portal that
//    holds their TFN. Missing details are now specific asks with a reason, and
//    nothing at all is said when there's nothing to say.
//  · A "quick actions" row that duplicated the navigation.
//  · An employees/industries rollup nobody opens this page to read.
// ─────────────────────────────────────────────────────────────────────────────

function AnswerLine({ children, tone }: { children: React.ReactNode; tone: 'calm' | 'action' }) {
  return (
    <p
      className={
        tone === 'action'
          ? 'font-display text-3xl leading-tight font-medium text-warn-700 sm:text-4xl'
          : 'font-display text-3xl leading-tight font-medium text-ink sm:text-4xl'
      }
    >
      {children}
    </p>
  )
}

export function DashboardPage() {
  const renewals = useQuery(getAsicRenewalsOptions())
  const names = useQuery(getBusinessNamesOptions())
  const profile = useQuery(getProfileOptions())
  const threads = useQuery(getMessageThreadsOptions())

  const loading = renewals.isPending || names.isPending
  // If the two queries this page's answer depends on both failed, saying
  // "nothing needs your attention" would be a lie.
  const failed = renewals.isError && names.isError

  // Urgency is derived from the due date with the same rule the rest of the app
  // uses, rather than the server's `tone` field — one threshold, one answer.
  const due = (renewals.data ?? [])
    .map((item) => ({ item, status: renewalStatus(item.dueDate) }))
    .filter(({ status }) => status.needsAction)
    .sort((a, b) => (a.status.days ?? 0) - (b.status.days ?? 0))

  const overdue = due.filter(({ status }) => status.tone === 'overdue')
  const nameList = [...(names.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  const unread = (threads.data ?? []).reduce((n, t) => n + (Number(t.unreadForClient) || 0), 0)

  // Only ask for details that have a concrete reason to exist, and only when
  // they're actually missing.
  const asks: { label: string; href: string }[] = []
  if (profile.data && !profile.data.phone) {
    asks.push({ label: 'Add a phone number so we can reach you about a renewal', href: '/profile' })
  }
  if (profile.data && !profile.data.firstName) {
    asks.push({ label: 'Tell us your name so we know who we’re writing to', href: '/profile' })
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── The answer ── */}
      <section className="flex flex-col gap-4 border-b border-rule-firm pb-8">
        {loading ? (
          <>
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : failed ? (
          <AnswerLine tone="calm">We couldn’t load your records</AnswerLine>
        ) : due.length === 0 ? (
          <>
            <AnswerLine tone="calm">Nothing needs your attention.</AnswerLine>
            <p className="max-w-prose text-sm text-ink-faint">
              {nameList.length > 0
                ? `We’re watching ${nameList.length === 1 ? 'your business name' : `all ${nameList.length} of your business names`} and will email you well before anything is due.`
                : 'Add a business name and we’ll track its renewal date for you.'}
            </p>
          </>
        ) : (
          <>
            <AnswerLine tone="action">
              {overdue.length > 0
                ? `${overdue.length === 1 ? 'One registration is' : `${overdue.length} registrations are`} overdue.`
                : `${due.length === 1 ? 'One registration needs' : `${due.length} registrations need`} renewing.`}
            </AnswerLine>
            <p className="max-w-prose text-sm text-ink-faint">
              {overdue.length > 0
                ? 'A lapsed business name can be taken by someone else. Renewing restores it if you act quickly.'
                : 'Renewing early costs the same and takes a couple of minutes.'}
            </p>
          </>
        )}
      </section>

      {/* ── What to do about it ── */}
      {due.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-medium text-ink">Needs your attention</h2>
          <RecordList>
            {due.map(({ item, status }) => (
              <Record key={`${item.kind}-${item.sourceId}`} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl leading-tight font-medium text-ink">{item.name}</h3>
                    <p className="mt-0.5 text-sm text-ink-faint">
                      {item.kind} · due {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={status.tone}>
                      {status.tone === 'overdue'
                        ? `${Math.abs(status.days ?? 0)} days overdue`
                        : `${status.days} days left`}
                    </Badge>
                    {item.kind === 'Business Name' ? (
                      <Button asChild size="sm">
                        <Link to={`/asic-renewals/${item.sourceId}/renew`}>Renew</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/asic-renewals">Manage</Link>
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
            ))}
          </RecordList>
        </section>
      ) : null}

      {/* ── The register itself ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-medium text-ink">Your business names</h2>
          {nameList.length > 0 ? (
            <Link
              to="/business-names"
              className="inline-flex items-center gap-1 text-sm text-accent-600 hover:underline"
            >
              Manage
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {names.isPending ? (
          <RecordList aria-busy="true">
            <RecordSkeleton />
            <RecordSkeleton />
          </RecordList>
        ) : names.isError ? (
          <ErrorState
            description="We couldn’t load your business names just now."
            action={
              <Button variant="secondary" onClick={() => void names.refetch()}>
                Try again
              </Button>
            }
          />
        ) : nameList.length === 0 ? (
          <EmptyState
            title="No business names yet"
            description="Add a name you hold with ASIC and we’ll track when it needs renewing."
            action={
              <Button asChild>
                <Link to="/business-names">Add a business name</Link>
              </Button>
            }
          />
        ) : (
          <RecordList>
            {nameList.map((name) => {
              const status = renewalStatus(name.renewalDate)
              return (
                <Record key={name.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display min-w-0 flex-1 text-xl leading-tight font-medium text-ink">
                      {name.name}
                    </h3>
                    <span className="shrink-0 text-sm text-ink-faint">
                      {status.days !== null && status.tone === 'ok' ? `${status.days} days left` : status.label}
                    </span>
                  </div>
                  <ValidityBand
                    className="mt-3"
                    registeredDate={name.dateRegistered}
                    renewalDate={name.renewalDate}
                    status={status}
                  />
                </Record>
              )
            })}
          </RecordList>
        )}
      </section>

      {/* ── Quiet asks, only when there is something to ask ── */}
      {asks.length > 0 ? (
        <Panel className="flex flex-col gap-3">
          <PanelTitle as="h2" className="text-lg">
            A couple of details would help
          </PanelTitle>
          <ul className="flex flex-col gap-2">
            {asks.map((ask) => (
              <li key={ask.label}>
                <Link to={ask.href} className="text-sm text-accent-600 hover:underline">
                  {ask.label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {unread > 0 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            You have {unread} unread {unread === 1 ? 'message' : 'messages'} from our team.
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link to="/messages">Read messages</Link>
          </Button>
        </Panel>
      ) : null}
    </div>
  )
}
