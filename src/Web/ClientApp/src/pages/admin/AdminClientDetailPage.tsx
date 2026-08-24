import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { getAdminClientOptions } from '@/api/generated/@tanstack/react-query.gen'
import { startImpersonation } from '@/api/generated'
import { formatAbn, formatAcn, maskTfn } from '@/lib/format'
import { formatDate } from '@/lib/dates'
import { renewalStatus } from '@/lib/renewal'
import {
  Badge,
  Button,
  Dialog,
  ErrorState,
  Field,
  PageHeader,
  Panel,
  PanelTitle,
  Skeleton,
  toastError,
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
    address: string
    suburb: string
    state: string
    postcode: string
  }
  entities: { id: string; name: string; entityType: string; abn: string; acn: string; industry: string }[]
  businessNames: { id: string; name: string; renewalDate: string; asicKey: string }[]
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

  const impersonate = useMutation({
    mutationFn: () => startImpersonation({ path: { id: id! }, body: { reason: reason.trim() } }),
    onSuccess: () => navigate('/dashboard'),
    onError: () => toastError('Couldn’t start that session', 'Try again in a moment.'),
  })

  if (client.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (client.isError || !client.data) {
    return (
      <ErrorState
        title="We couldn’t open this client"
        description="They may have been removed, or the link may be out of date."
        action={
          <Button asChild variant="secondary">
            <Link to="/admin/clients">Back to clients</Link>
          </Button>
        }
      />
    )
  }

  const detail = client.data
  const profile = detail.profile
  const name = `${profile.firstName} ${profile.lastName}`.trim() || detail.email
  const address = [profile.address, profile.suburb, profile.state, profile.postcode].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/clients"
        className="inline-flex items-center gap-1.5 self-start text-sm text-bottle-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        All clients
      </Link>

      <PageHeader
        title={name}
        description={detail.email}
        actions={
          <Button asChild variant="secondary">
            <Link to={`/admin/messages/${detail.id}`}>
              <MessageSquare aria-hidden className="size-4" />
              Messages
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="flex flex-col gap-4">
          <PanelTitle as="h2" className="text-lg">
            Contact
          </PanelTitle>
          <dl className="flex flex-col gap-2.5 text-sm">
            {[
              ['Phone', profile.phone || '—'],
              ['Date of birth', profile.dob ? formatDate(profile.dob) : '—'],
              ['Tax file number', maskTfn(profile.tfn) || '—'],
              ['Address', address || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap gap-x-3">
                <dt className="w-36 shrink-0 text-sage">{label}</dt>
                <dd className="min-w-0 flex-1 text-ink" data-numeric>
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-36 shrink-0 text-sage">ATO</dt>
              <dd className="min-w-0 flex-1">
                {detail.atoConnected ? <Badge tone="ok">Connected</Badge> : <span className="text-sage">Not connected</span>}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <PanelTitle as="h2" className="text-lg">
            Businesses
          </PanelTitle>
          {detail.entities.length === 0 ? (
            <p className="text-sm text-sage">None recorded.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {detail.entities.map((entity) => (
                <li key={entity.id} className="flex flex-col gap-0.5">
                  <span className="font-medium text-ink">{entity.name}</span>
                  <span className="text-sage" data-numeric>
                    {[
                      entity.entityType,
                      entity.abn ? `ABN ${formatAbn(entity.abn)}` : null,
                      entity.acn ? `ACN ${formatAcn(entity.acn)}` : null,
                      entity.industry,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4">
        <PanelTitle as="h2" className="text-lg">
          Business names
        </PanelTitle>
        {detail.businessNames.length === 0 ? (
          <p className="text-sm text-sage">None recorded.</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {detail.businessNames.map((bn) => {
              const status = renewalStatus(bn.renewalDate)
              return (
                <li key={bn.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{bn.name}</span>
                    {status.needsAction ? (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    ) : (
                      <span className="text-sm text-sage">{formatDate(bn.renewalDate)}</span>
                    )}
                  </div>
                  <ValidityBand
                    className="mt-1"
                    registeredDate={undefined}
                    renewalDate={bn.renewalDate}
                    status={status}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <PanelTitle as="h2" className="text-lg">
          Sign in as this client
        </PanelTitle>
        <p className="max-w-prose text-sm text-sage">
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
    </div>
  )
}
