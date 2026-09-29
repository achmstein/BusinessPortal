import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router-dom'
import { CalendarCheck, CreditCard, ShieldCheck } from 'lucide-react'
import {
  getBusinessNamesOptions,
  getCompletedRenewalsOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import { getRenewalCheckout } from '@/api/generated'
import { formatDate } from '@/lib/dates'
import { extendedRenewalDate, renewalStatus } from '@/lib/renewal'
import { Button, ErrorState, List, Page, PageSkeleton, Panel, PanelTitle, TextLink, toastError } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Renewing hands off to Renewtron's checkout, which takes the card payment
// (Stripe — card details never touch this application) and starts the renewal
// with ASIC straight away. The portal passes along what it already knows — ABN,
// name, email, phone, date of birth — so the customer isn't asked twice, then
// tracks the renewal from payment to ASIC's confirmation on the Renewals page.
//
// The term is chosen on the checkout itself; this page shows what each term buys
// (the date it runs to), because that's the question people bring here.
// ─────────────────────────────────────────────────────────────────────────────

const TERMS = [1, 3]
const IN_FLIGHT = new Set(['Scheduled', 'Pending', 'Processing'])

export function RenewBusinessNamePage() {
  const { bnId } = useParams<{ bnId: string }>()
  const names = useQuery(getBusinessNamesOptions())
  const renewals = useQuery(getCompletedRenewalsOptions())

  const checkout = useMutation({
    mutationFn: async () => (await getRenewalCheckout({ query: { businessNameId: bnId }, throwOnError: true })).data,
    onSuccess: (data) => {
      if (data?.url) window.location.assign(data.url)
    },
    onError: () => toastError('Online renewal isn’t available right now', 'Try again shortly, or message us.'),
  })

  const back = { to: '/asic-renewals', label: 'Back to renewals' }

  if (names.isPending) {
    return (
      <Page title="Renew this business name" back={back}>
        <PageSkeleton />
      </Page>
    )
  }

  if (names.isError) {
    return (
      <Page title="Renew this business name" back={back}>
        <ErrorState
          description="We couldn’t load that business name."
          action={
            <Button variant="secondary" onClick={() => void names.refetch()}>
              Try again
            </Button>
          }
        />
      </Page>
    )
  }

  const name = (names.data ?? []).find((b) => b.id === bnId)
  if (!name) return <Navigate to="/asic-renewals" replace />

  const status = renewalStatus(name.renewalDate)
  const inFlight = (renewals.data ?? []).find(
    (r) =>
      IN_FLIGHT.has(r.status ?? '') &&
      (r.businessNameId === name.id || r.businessName?.trim().toLowerCase() === name.name?.trim().toLowerCase()),
  )

  return (
    <Page
      back={back}
      title="Renew this business name"
      description={
        <>
          <strong className="font-medium text-ink">{name.name}</strong>
          {name.renewalDate ? (
            <>
              {' '}
              · {status.tone === 'overdue' ? 'was due' : 'currently runs to'} {formatDate(name.renewalDate)}
            </>
          ) : null}
        </>
      }
    >
      {inFlight ? (
        <Panel className="flex flex-col gap-2">
          <PanelTitle>This renewal is already paid for</PanelTitle>
          <p className="text-sm text-ink-muted">
            {inFlight.status === 'Scheduled'
              ? `We received your payment on ${formatDate(inFlight.renewedAt)}. ${inFlight.statusMessage ?? ''}`
              : `We received your payment on ${formatDate(inFlight.renewedAt)} and are renewing it with ASIC now.${inFlight.statusMessage ? ` ${inFlight.statusMessage}` : ''}`}
          </p>
          <TextLink to="/asic-renewals" arrow className="self-start">
            Follow it on Renewals
          </TextLink>
        </Panel>
      ) : (
        <>
          <Panel className="flex flex-col gap-4">
            <PanelTitle>How long it will run to</PanelTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {TERMS.map((years) => (
                <div key={years} className="flex flex-col gap-1 rounded-lg border border-rule px-4 py-3">
                  <span className="text-sm text-ink-faint">
                    {years} year{years > 1 ? 's' : ''}
                  </span>
                  <span className="font-display text-xl leading-tight font-semibold text-ink">
                    Yours until {formatDate(extendedRenewalDate(name.renewalDate, years))}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-faint">You’ll choose the term and see the price on the next step.</p>
          </Panel>

          <List>
            <List.Row>
              <CreditCard aria-hidden className="size-4 shrink-0 text-accent-600" />
              <span className="min-w-0 flex-1 text-sm text-ink-muted">
                Pay by card on our secure checkout — your details are filled in for you.
              </span>
            </List.Row>
            <List.Row>
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-accent-600" />
              <span className="min-w-0 flex-1 text-sm text-ink-muted">
                We lodge the renewal with ASIC as soon as your payment clears.
              </span>
            </List.Row>
            <List.Row>
              <CalendarCheck aria-hidden className="size-4 shrink-0 text-accent-600" />
              <span className="min-w-0 flex-1 text-sm text-ink-muted">
                Its progress, ASIC’s reference and the new date appear here under Renewals.
              </span>
            </List.Row>
          </List>

          <Button className="self-start" loading={checkout.isPending} onClick={() => checkout.mutate()}>
            Continue to secure checkout
          </Button>
        </>
      )}
    </Page>
  )
}
