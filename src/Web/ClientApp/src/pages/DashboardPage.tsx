import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FileText,
  KeyRound,
  Landmark,
  MessageSquare,
  UserRound,
} from 'lucide-react'
import {
  getAsicRenewalsOptions,
  getAtoStatusOptions,
  getBusinessEntitiesOptions,
  getBusinessNamesOptions,
  getCompletedRenewalsOptions,
  getMessageThreadsOptions,
  getProfileOptions,
  getBusinessNamesQueryKey,
  requestAsicKeyMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import { renewalStatus } from '@/lib/renewal'
import { formatDate, formatRelativeTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  ErrorState,
  List,
  Page,
  Panel,
  PanelTitle,
  PageSkeleton,
  Section,
  TextLink,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The Overview answers one question: what do I need to do?
//
// Everything that wants the customer's attention — a renewal falling due, a
// reply from the team, a name with no ASIC key, a gap in their details — is
// gathered into one "To do" list, most urgent first, each with the button that
// deals with it. People arrive here from a renewal email once or twice a year;
// they should be able to act without learning where things live.
//
// The side column is reference, not action: how many names are tracked, when
// the next one falls due, and what has been renewed recently.
//
// Until the account is set up — a business, its business names, the ATO link —
// a "Get set up" checklist leads the page instead, in the order those need
// doing. Customers who came through a Renewtron sign-in link already have their
// business and names added for them, so those steps arrive ticked and only ask
// them to add any others.
// ─────────────────────────────────────────────────────────────────────────────

type TaskTone = 'overdue' | 'due' | 'info'

interface Task {
  key: string
  tone: TaskTone
  icon: ReactNode
  title: string
  detail: string
  action: ReactNode
}

const TONE_ORDER: Record<TaskTone, number> = { overdue: 0, due: 1, info: 2 }

const ICON_TONES: Record<TaskTone, string> = {
  overdue: 'bg-danger-50 text-danger-700',
  due: 'bg-warn-50 text-warn-700',
  info: 'bg-accent-50 text-accent-700',
}

/** Inline ASIC-key requests only while there are few; past that, one grouped task. */
const MAX_INLINE_KEY_REQUESTS = 2

const HEADLINE_TONES = { calm: 'text-ink', action: 'text-warn-700', urgent: 'text-danger-700' } as const

interface SetupStep {
  key: string
  icon: ReactNode
  title: string
  detail: string
  done: boolean
  action?: ReactNode
}

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  return (
    <Section title="Get set up" meta={`${doneCount} of ${steps.length} done`}>
      <List>
        {steps.map((step, index) => (
          <List.Row key={step.key}>
            <span
              aria-hidden
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full',
                step.done ? 'bg-accent-50 text-accent-700' : 'border border-rule-firm text-ink-faint',
              )}
            >
              {step.done ? <CheckCircle2 className="size-4" /> : step.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">
                <span className="sr-only">{step.done ? 'Done: ' : `Step ${index + 1}: `}</span>
                {step.title}
              </p>
              <p className="text-sm text-ink-faint">{step.detail}</p>
            </div>
            {step.action ? <div className="shrink-0">{step.action}</div> : null}
          </List.Row>
        ))}
      </List>
    </Section>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs tracking-[0.08em] text-ink-faint uppercase">{label}</dt>
      <dd className="font-display text-2xl leading-tight font-medium text-ink" data-numeric>
        {value}
      </dd>
      {hint ? <dd className="text-sm text-ink-faint">{hint}</dd> : null}
    </div>
  )
}

export function DashboardPage() {
  const renewals = useQuery(getAsicRenewalsOptions())
  const names = useQuery(getBusinessNamesOptions())
  const entities = useQuery(getBusinessEntitiesOptions())
  const profile = useQuery(getProfileOptions())
  const threads = useQuery(getMessageThreadsOptions())
  const completed = useQuery(getCompletedRenewalsOptions())
  const ato = useQuery(getAtoStatusOptions())

  const queryClient = useQueryClient()
  const requestKey = useMutation({
    ...requestAsicKeyMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getBusinessNamesQueryKey() })
      toastSuccess('ASIC key requested', 'We’ve asked ASIC for a copy — it’ll appear on the name when it arrives.')
    },
    onError: (error) =>
      toastError('Couldn’t request the key', (error as { error?: string } | undefined)?.error ?? 'Try again in a moment.'),
  })

  const loading = renewals.isPending || names.isPending
  // If the two queries the answer depends on both failed, "nothing to do"
  // would be a lie.
  const failed = renewals.isError && names.isError

  const nameList = [...(names.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  // Paid renewals Renewtron is still working on, and ones that stalled.
  const paid = completed.data ?? []
  const underway = paid.filter((r) => r.status === 'Scheduled' || r.status === 'Pending' || r.status === 'Processing')
  const stalled = paid.filter((r) => r.status === 'Failed')
  const isUnderway = (id?: string, name?: string | null) =>
    underway.some(
      (r) => (id && r.businessNameId === id) || r.businessName?.trim().toLowerCase() === name?.trim().toLowerCase(),
    )

  // Urgency comes from the due date via the shared rule, not the server's tone.
  // A name that's already paid for and with ASIC isn't something to do.
  const due = (renewals.data ?? [])
    .map((item) => ({ item, status: renewalStatus(item.dueDate) }))
    .filter(({ item, status }) => status.needsAction && !isUnderway(item.sourceId, item.name))
    .sort((a, b) => (a.status.days ?? 0) - (b.status.days ?? 0))
  const overdueCount = due.filter(({ status }) => status.tone === 'overdue').length

  const unreadThreads = (threads.data ?? []).filter((t) => Number(t.unreadForClient) > 0)
  // Names with an open request are in hand — only a failed one needs asking again.
  const noKey = nameList.filter(
    (n) => !n.asicKey && (!n.asicKeyRequestStatus || n.asicKeyRequestStatus === 'Failed'),
  )
  const noDate = nameList.filter((n) => !n.renewalDate)

  // ── Build the to-do list ──
  const tasks: Task[] = []

  for (const { item, status } of due) {
    const overdue = status.tone === 'overdue'
    tasks.push({
      key: `renew-${item.kind}-${item.sourceId}`,
      tone: overdue ? 'overdue' : 'due',
      icon: overdue ? <AlertTriangle className="size-4" /> : <CalendarClock className="size-4" />,
      title: overdue ? `Renew ${item.name} — it’s overdue` : `Renew ${item.name}`,
      detail: overdue
        ? `Lapsed ${Math.abs(status.days ?? 0)} days ago. A lapsed name can be registered by someone else.`
        : `Due ${formatDate(item.dueDate)} — ${status.days} days left.`,
      action:
        item.kind === 'Business Name' ? (
          <Button asChild size="sm" variant={overdue ? 'danger' : 'primary'}>
            <Link to={`/asic-renewals/${item.sourceId}/renew`}>Renew now</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="secondary">
            <Link to="/asic-renewals">Manage</Link>
          </Button>
        ),
    })
  }

  for (const renewal of stalled) {
    tasks.push({
      key: `stalled-${renewal.id}`,
      tone: 'overdue',
      icon: <AlertTriangle className="size-4" />,
      title: `Your renewal of ${renewal.businessName} needs attention`,
      detail: renewal.statusMessage ?? 'We hit a problem lodging it with ASIC — our team will be in touch.',
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link to="/messages">Message us</Link>
        </Button>
      ),
    })
  }

  if (unreadThreads.length > 0) {
    const first = unreadThreads[0]
    tasks.push({
      key: 'messages',
      tone: 'info',
      icon: <MessageSquare className="size-4" />,
      title:
        unreadThreads.length === 1
          ? `Our team replied: ${first.subject}`
          : `${unreadThreads.length} conversations have new replies`,
      detail: first.lastActivityAt ? `Latest ${formatRelativeTime(first.lastActivityAt)}.` : 'Waiting for you.',
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link to="/messages">Read</Link>
        </Button>
      ),
    })
  }

  if (noKey.length > MAX_INLINE_KEY_REQUESTS) {
    tasks.push({
      key: 'asic-keys',
      tone: 'info',
      icon: <KeyRound className="size-4" />,
      title: `${noKey.length} business names have no ASIC key`,
      detail: 'You need the key to make changes with ASIC. Request a copy for each one.',
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link to="/business-names">Review names</Link>
        </Button>
      ),
    })
  } else {
    for (const name of noKey) {
      tasks.push({
        key: `asic-key-${name.id}`,
        tone: 'info',
        icon: <KeyRound className="size-4" />,
        title: `No ASIC key for ${name.name}`,
        detail: 'You need it to make changes with ASIC. We can ask ASIC for a copy.',
        action: (
          <Button
            size="sm"
            variant="secondary"
            disabled={requestKey.isPending}
            onClick={() => requestKey.mutate({ path: { id: name.id! } })}
          >
            Request key
          </Button>
        ),
      })
    }
  }

  if (noDate.length > 0) {
    tasks.push({
      key: 'renewal-dates',
      tone: 'info',
      icon: <CalendarPlus className="size-4" />,
      title:
        noDate.length === 1
          ? `Add the renewal date for ${noDate[0].name}`
          : `${noDate.length} names are missing a renewal date`,
      detail: 'Without it we can’t remind you before it lapses.',
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link to="/business-names">Add date</Link>
        </Button>
      ),
    })
  }

  if (profile.data && (!profile.data.firstName || !profile.data.phone)) {
    tasks.push({
      key: 'profile',
      tone: 'info',
      icon: <UserRound className="size-4" />,
      title: !profile.data.firstName ? 'Tell us your name' : 'Add a phone number',
      detail: 'So we can reach you before a renewal falls due.',
      action: (
        <Button asChild size="sm" variant="secondary">
          <Link to="/profile">Update details</Link>
        </Button>
      ),
    })
  }

  tasks.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])

  // ── Setup checklist ──
  const entityList = entities.data ?? []
  const atoConnected = Boolean(ato.data?.connected)
  const setupSteps: SetupStep[] = [
    {
      key: 'account',
      icon: <UserRound className="size-4" />,
      title: 'Create your account',
      detail: 'You’re in.',
      done: true,
    },
    {
      key: 'business',
      icon: <Building2 className="size-4" />,
      title: entityList.length > 0 ? 'Your business' : 'Add your business',
      detail:
        entityList.length > 0
          ? `${entityList[0].name}${entityList.length > 1 ? ` and ${entityList.length - 1} more` : ''} — check the details and add any others you run.`
          : 'Its ABN lets us find every business name registered to it.',
      done: entityList.length > 0,
      action: (
        <Button asChild size="sm" variant={entityList.length > 0 ? 'secondary' : 'primary'}>
          <Link to="/business">{entityList.length > 0 ? 'Review' : 'Add business'}</Link>
        </Button>
      ),
    },
    {
      key: 'names',
      icon: <FileText className="size-4" />,
      title: nameList.length > 0 ? 'Your business names' : 'Add your business names',
      detail:
        nameList.length > 0
          ? `${nameList.length === 1 ? 'One name' : `${nameList.length} names`} on file — add any others you hold.`
          : 'We’ll track each one’s renewal date and remind you before it lapses.',
      done: nameList.length > 0,
      action: (
        <Button asChild size="sm" variant={nameList.length > 0 || entityList.length === 0 ? 'secondary' : 'primary'}>
          <Link to="/business-names">{nameList.length > 0 ? 'Review' : 'Add names'}</Link>
        </Button>
      ),
    },
    {
      key: 'ato',
      icon: <Landmark className="size-4" />,
      title: atoConnected ? 'Linked to the ATO' : 'Link to the ATO',
      detail: atoConnected
        ? 'We can keep your business details in step with the ATO.'
        : 'So we can keep your business details in step with the ATO.',
      done: atoConnected,
      action: atoConnected ? undefined : (
        <Button
          asChild
          size="sm"
          variant={entityList.length > 0 && nameList.length > 0 ? 'primary' : 'secondary'}
        >
          <Link to="/ato-portal">Link</Link>
        </Button>
      ),
    },
  ]
  // Only once all three answers are in: a checklist that flashes up while the
  // ATO status loads, then vanishes, is worse than none.
  const setupKnown = entities.isSuccess && names.isSuccess && ato.isSuccess
  const settingUp = setupKnown && setupSteps.some((step) => !step.done)

  // ── Side column facts ──
  const upcoming = nameList
    .map((n) => ({ name: n, status: renewalStatus(n.renewalDate) }))
    .filter(({ status }) => status.days !== null && status.days >= 0)
    .sort((a, b) => (a.status.days ?? 0) - (b.status.days ?? 0))[0]
  const finished = paid.filter((r) => r.status === 'Completed')
  const recentRenewals = finished.slice(0, 3)

  // ── The answer: the page title itself ──
  let tone: keyof typeof HEADLINE_TONES = 'calm'
  let title: string
  let description: string | undefined
  if (failed) {
    title = 'We couldn’t load your records'
    description = 'Try again in a moment.'
  } else if (overdueCount > 0) {
    tone = 'urgent'
    title = `${overdueCount === 1 ? 'One registration is' : `${overdueCount} registrations are`} overdue.`
    description = 'Renewing restores it if you act quickly — it’s the first thing on your list below.'
  } else if (due.length > 0) {
    tone = 'action'
    title = `${due.length === 1 ? 'One registration needs' : `${due.length} registrations need`} renewing.`
    description = 'Renewing early costs the same and takes a couple of minutes.'
  } else if (settingUp) {
    title = 'Let’s get your business set up.'
    description = 'A few steps, in this order — anything we already hold for you is filled in.'
  } else if (tasks.length > 0) {
    title = 'Your registrations are in order.'
  } else {
    title = 'Nothing needs your attention.'
    description =
      nameList.length > 0
        ? `We’re watching ${nameList.length === 1 ? 'your business name' : `all ${nameList.length} of your business names`} and will email you well before anything is due.`
        : 'Add a business name and we’ll track its renewal date for you.'
  }

  return (
    <Page
      eyebrow="Overview"
      title={loading ? 'Checking your records…' : <span className={HEADLINE_TONES[tone]}>{title}</span>}
      description={loading ? undefined : description}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* ── Main column: to do, then the register ── */}
        <div className="flex min-w-0 flex-col gap-6">
          {settingUp ? <SetupChecklist steps={setupSteps} /> : null}

          {/* Mid-setup, "you're all caught up" would contradict the checklist above. */}
          {settingUp && tasks.length === 0 ? null : (
            <Section
              title="To do"
              meta={tasks.length > 0 ? `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}` : undefined}
            >
              {loading ? (
                <PageSkeleton blocks={1} />
              ) : tasks.length === 0 ? (
                <Panel className="flex items-center gap-3">
                  <CheckCircle2 aria-hidden className="size-5 shrink-0 text-accent-600" />
                  <p className="text-sm text-ink-muted">You’re all caught up. We’ll let you know when something comes up.</p>
                </Panel>
              ) : (
                <List>
                  {tasks.map((task) => (
                    <List.Row key={task.key}>
                      <span
                        aria-hidden
                        className={cn('grid size-9 shrink-0 place-items-center rounded-full', ICON_TONES[task.tone])}
                      >
                        {task.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{task.title}</p>
                        <p className="text-sm text-ink-faint">{task.detail}</p>
                      </div>
                      <div className="shrink-0">{task.action}</div>
                    </List.Row>
                  ))}
                </List>
              )}
            </Section>
          )}

          <Section
            title="Your business names"
            action={
              <TextLink to="/business-names" arrow>
                {nameList.length > 0 ? 'Manage' : 'Add a name'}
              </TextLink>
            }
          >
            {names.isPending ? (
              <PageSkeleton blocks={1} />
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
              <Panel>
                <p className="text-sm text-ink-faint">
                  No business names yet. Add one you hold with ASIC and we’ll track when it needs renewing.
                </p>
              </Panel>
            ) : (
              <List>
                {nameList.map((name) => {
                  const status = renewalStatus(name.renewalDate)
                  return (
                    <List.Row key={name.id} className="justify-between py-3">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{name.name}</span>
                      <span className="text-sm text-ink-faint" data-numeric>
                        {name.renewalDate ? `Renews ${formatDate(name.renewalDate)}` : 'No renewal date'}
                      </span>
                      {status.needsAction ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                    </List.Row>
                  )
                })}
              </List>
            )}
          </Section>
        </div>

        {/* ── Side column: reference ── */}
        <aside className="flex flex-col gap-6">
          <Panel className="flex flex-col gap-4">
            <PanelTitle as="h2">
              At a glance
            </PanelTitle>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <Stat
                label="Business names"
                value={names.isPending ? '—' : nameList.length}
                hint={entities.data ? `${entities.data.length} ${entities.data.length === 1 ? 'business' : 'businesses'}` : undefined}
              />
              <Stat
                label="Next renewal"
                value={upcoming ? formatDate(upcoming.name.renewalDate) : '—'}
                hint={upcoming ? upcoming.name.name : 'Nothing scheduled'}
              />
              <Stat
                label="Renewals completed"
                value={completed.isPending ? '—' : finished.length}
                hint={underway.length > 0 ? `${underway.length} in progress` : undefined}
              />
            </dl>
          </Panel>

          {recentRenewals.length > 0 ? (
            <Panel className="flex flex-col gap-3">
              <PanelTitle as="h2">
                Recently renewed
              </PanelTitle>
              <ul className="flex flex-col gap-3">
                {recentRenewals.map((r) => (
                  <li key={r.id} className="flex items-start gap-2.5">
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.businessName}</p>
                      <p className="text-xs text-ink-faint">
                        {formatDate(r.renewedAt)}
                        {r.newRenewalDate ? ` · next due ${formatDate(r.newRenewalDate)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <TextLink to="/asic-renewals" arrow>
                See all renewals
              </TextLink>
            </Panel>
          ) : null}

          <Panel className="flex flex-col gap-2">
            <PanelTitle as="h2">
              Need a hand?
            </PanelTitle>
            <p className="text-sm text-ink-faint">Our team usually replies within one business day.</p>
            <Button asChild size="sm" variant="secondary" className="self-start">
              <Link to="/messages">Message us</Link>
            </Button>
          </Panel>
        </aside>
      </div>
    </Page>
  )
}
