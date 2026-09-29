import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import {
  applyPendingAsicKeyMutation,
  resendWelcomeEmailMutation,
  getAdminClientOptions,
  getAdminClientQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { startImpersonation } from '@/api/generated'
import { formatAbn, formatAcn, maskTfn } from '@/lib/format'
import { formatDate, formatDateTime } from '@/lib/dates'
import { renewalStatus } from '@/lib/renewal'
import {
  Badge,
  Button,
  CopyButton,
  Dialog,
  ErrorState,
  Field,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  ShowMore,
  toastError,
  toastSuccess,
  ValidityBand,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// One client, as staff see them.
//
// Two changes worth naming:
//
//  · Impersonation now asks, and the reason is required. It was a single click
//    beside a free-text box labelled "Reason (optional)" — an audit trail whose
//    reason is optional is not much of an audit trail, and this is the control
//    that lets a staff member act as a customer with full write access.
//  · The tax file number is masked. It rendered in full on a screen staff often
//    have open beside someone else's desk, for no reason anyone needed.
//
// Business names carry the same validity band the client sees, so a support
// conversation starts from the same picture the customer is looking at.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_KINDS: Record<string, string> = {
  Welcome: 'Welcome email',
  PasswordReset: 'Password reset',
  Confirmation: 'Email confirmation',
}

interface ClientDetail {
  id: string
  email: string
  atoConnected: boolean
  profile: {
    firstName: string
    lastName: string
    phone: string
    dob: string
    tfn: string
    abn: string
    address: string
    suburb: string
    state: string
    postcode: string
  }
  entities: { id: string; name: string; entityType: string; abn: string; acn: string; industry: string }[]
  emails: { kind: string; status: string; error: string | null; at: string }[]
  businessNames: {
    id: string
    name: string
    renewalDate: string
    asicKey: string
    pendingAsicKey: string | null
    asicKeyRequestStatus: string | null
  }[]
}

const BACK = { to: '/admin/clients', label: 'All clients' }

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Unspecified: '', // says nothing — left out of the line
  SoleTrader: 'Sole trader',
  Partnership: 'Partnership',
  Company: 'Company',
  Trust: 'Trust',
}

function NoneRecorded({ what }: { what: string }) {
  return <p className="text-sm text-ink-faint">No {what} recorded.</p>
}

export function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()

  // The endpoint returns an anonymous shape, so this is the one place a local
  // type is still needed. Narrowed once, here, rather than in every consumer.
  const client = useQuery({
    ...getAdminClientOptions({ path: { id: id! } }),
    select: (data) => data as unknown as ClientDetail,
  })

  const queryClient = useQueryClient()
  // A key Renewtron retrieved for a name this client asked about but didn't renew
  // through us. Staff confirm the client owns the name before it's released.
  const applyKey = useMutation({
    ...applyPendingAsicKeyMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getAdminClientQueryKey({ path: { id: id! } }) })
      toastSuccess('ASIC key added to the client’s business name')
    },
    onError: () => toastError('Couldn’t apply that key', 'Try again in a moment.'),
  })

  const resendWelcome = useMutation({
    ...resendWelcomeEmailMutation(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: getAdminClientQueryKey({ path: { id: id! } }) })
      if (result.status === 'Sent') toastSuccess('Welcome email sent')
      else if (result.status === 'NotConfigured') toastError('Email isn’t set up', 'Add the provider key in Integrations.')
      else toastError('The email provider rejected it', 'Check the key in Integrations.')
    },
    onError: () => toastError('Couldn’t send the welcome email', 'Try again in a moment.'),
  })

  const impersonate = useMutation({
    mutationFn: () => startImpersonation({ path: { id: id! }, body: { reason: reason.trim() } }),
    onSuccess: () => navigate('/'),
    onError: () => toastError('Couldn’t start that session', 'Try again in a moment.'),
  })

  if (client.isPending) {
    return (
      <Page title="Client" back={BACK}>
        <PageSkeleton blocks={3} />
      </Page>
    )
  }

  if (client.isError || !client.data) {
    return (
      <Page title="Client" back={BACK}>
        <ErrorState
          title="We couldn’t open this client"
          description="They may have been removed, or the link may be out of date."
          action={
            <Button asChild variant="secondary">
              <Link to="/admin/clients">Back to clients</Link>
            </Button>
          }
        />
      </Page>
    )
  }

  const detail = client.data
  const profile = detail.profile
  const name = `${profile.firstName} ${profile.lastName}`.trim() || detail.email
  const address = [profile.address, profile.suburb, profile.state, profile.postcode].filter(Boolean).join(', ')

  return (
    <Page
      title={name}
      back={BACK}
      description={
        <span className="flex items-center gap-1">
          {detail.email}
          <CopyButton value={detail.email} label="Copy this client’s email" />
        </span>
      }
      actions={
        <Button asChild variant="secondary">
          <Link to={`/admin/messages/${detail.id}`}>
            <MessageSquare aria-hidden className="size-4" />
            Messages
          </Link>
        </Button>
      }
    >

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="flex flex-col gap-4">
          <PanelTitle>
            Contact
          </PanelTitle>
          <dl className="flex flex-col gap-2.5 text-sm">
            {[
              ['Phone', profile.phone || '—'],
              ['Date of birth', profile.dob ? formatDate(profile.dob) : '—'],
              ['Tax file number', maskTfn(profile.tfn) || '—'],
              ['ABN', profile.abn ? formatAbn(profile.abn) : '—'],
              ['Address', address || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap gap-x-3">
                <dt className="w-36 shrink-0 text-ink-faint">{label}</dt>
                <dd className="min-w-0 flex-1 text-ink" data-numeric>
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-36 shrink-0 text-ink-faint">ATO</dt>
              <dd className="min-w-0 flex-1">
                {detail.atoConnected ? <Badge tone="ok">Connected</Badge> : <span className="text-ink-faint">Not connected</span>}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <PanelTitle>
            Businesses
          </PanelTitle>
          {detail.entities.length === 0 ? (
            <NoneRecorded what="businesses" />
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              <ShowMore
                label="businesses"
                items={detail.entities.map((entity) => (
                <li key={entity.id} className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{entity.name}</span>
                  <span className="flex flex-wrap items-center gap-x-1 text-ink-faint" data-numeric>
                    {[ENTITY_TYPE_LABELS[entity.entityType] ?? entity.entityType, entity.industry]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    {entity.abn ? (
                      <span className="flex items-center gap-1">
                        · ABN {formatAbn(entity.abn)}
                        {/* Raw digits: the printed spacing fails validation
                            in most systems staff paste these into. */}
                        <CopyButton value={entity.abn} label={`Copy the ABN for ${entity.name}`} />
                      </span>
                    ) : null}
                    {entity.acn ? (
                      <span className="flex items-center gap-1">
                        · ACN {formatAcn(entity.acn)}
                        <CopyButton value={entity.acn} label={`Copy the ACN for ${entity.name}`} />
                      </span>
                    ) : null}
                  </span>
                  </li>
                ))}
              />
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4">
        <PanelTitle>
          Business names
        </PanelTitle>
        {detail.businessNames.length === 0 ? (
          <NoneRecorded what="business names" />
        ) : (
          <ul className="flex flex-col gap-5">
            <ShowMore
              label="business names"
              items={detail.businessNames.map((bn) => {
              const status = renewalStatus(bn.renewalDate)
              return (
                <li key={bn.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{bn.name}</span>
                    {status.needsAction ? (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    ) : (
                      <span className="text-sm text-ink-faint">{formatDate(bn.renewalDate)}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-sm text-ink-faint" data-numeric>
                    {bn.asicKey ? (
                      <>
                        ASIC key {bn.asicKey}
                        <CopyButton value={bn.asicKey} label={`Copy the ASIC key for ${bn.name}`} />
                      </>
                    ) : bn.pendingAsicKey ? (
                      <>
                        Key received, waiting for you to verify: {bn.pendingAsicKey}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="ml-2"
                          loading={applyKey.isPending}
                          onClick={() => applyKey.mutate({ path: { clientId: detail.id, id: bn.id } })}
                        >
                          Apply key
                        </Button>
                      </>
                    ) : bn.asicKeyRequestStatus ? (
                      `No ASIC key yet · request ${bn.asicKeyRequestStatus.toLowerCase()}`
                    ) : (
                      'No ASIC key on file'
                    )}
                  </span>
                  {bn.pendingAsicKey ? (
                    <span className="text-xs text-ink-faint">
                      They asked for this key but didn’t renew the name through us. Check they hold the name
                      before applying it — an ASIC key lets whoever has it change the registration.
                    </span>
                  ) : null}
                  <ValidityBand
                    className="mt-1"
                    registeredDate={undefined}
                    renewalDate={bn.renewalDate}
                    status={status}
                  />
                  </li>
                )
              })}
            />
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelTitle>Emails</PanelTitle>
          <Button
            size="sm"
            variant="secondary"
            loading={resendWelcome.isPending}
            onClick={() => resendWelcome.mutate({ path: { id: detail.id } })}
          >
            Resend welcome email
          </Button>
        </div>
        <p className="text-sm text-ink-faint">
          The welcome email carries a fresh one-click sign-in link and a set-password link. Contents aren’t kept —
          only whether each email went out.
        </p>
        {(detail.emails ?? []).length === 0 ? (
          <p className="text-sm text-ink-faint">No emails recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rule text-sm">
            {detail.emails.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <span className="text-ink">{EMAIL_KINDS[e.kind] ?? e.kind}</span>
                <span className="text-ink-faint">{formatDateTime(e.at)}</span>
                {e.status === 'Sent' ? (
                  <Badge tone="ok">Sent</Badge>
                ) : (
                  <Badge tone="overdue">{e.status === 'NotConfigured' ? 'Not sent — email not set up' : 'Failed'}</Badge>
                )}
                {e.error ? <span className="basis-full text-xs break-words text-danger-600">{e.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <PanelTitle>
          Sign in as this client
        </PanelTitle>
        <p className="max-w-prose text-sm text-ink-faint">
          You’ll see the portal exactly as {name} does, with full access to change their records. The session
          is recorded against your account, and a banner stays on screen until you return here.
        </p>
        <Button variant="secondary" className="self-start" onClick={() => setConfirming(true)}>
          Start a session
        </Button>
      </Panel>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) {
            setReason('')
            setReasonError(undefined)
          }
        }}
        title={`Sign in as ${name}?`}
        description="This is recorded against your account. Say why, so the record means something later."
        className="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              loading={impersonate.isPending}
              onClick={() => {
                if (reason.trim().length < 3) {
                  setReasonError('Give a short reason — this goes in the audit record.')
                  return
                }
                impersonate.mutate()
              }}
            >
              Start session
            </Button>
          </>
        }
      >
        <Field label="Reason" required error={reasonError}>
          <Field.Input
            value={reason}
            autoFocus
            onChange={(event) => {
              setReason(event.currentTarget.value)
              if (event.currentTarget.value.trim().length >= 3) setReasonError(undefined)
            }}
            placeholder="e.g. Checking a renewal they reported as missing"
          />
        </Field>
      </Dialog>
    </Page>
  )
}
