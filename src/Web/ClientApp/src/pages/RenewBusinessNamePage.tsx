import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { getBusinessNamesOptions } from '@/api/generated/@tanstack/react-query.gen'
import { useAuth } from '@/auth/AuthContext'
import { formatDate } from '@/lib/dates'
import { extendedRenewalDate, renewalStatus } from '@/lib/renewal'
import { Button, ErrorState, Page, PageSkeleton, Panel, PanelTitle, RadioGroup, TextLink } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Paying to renew.
//
// The thing someone is actually buying here is a date — how long their name
// stays theirs — but the old page showed only a price and a term, leaving the
// customer to do the arithmetic. Each option now leads with the expiry date it
// produces, and the price sits underneath.
//
// It also opened with three summary tiles and a term selector before the
// payment form, so on a phone you scrolled past a screen of chrome to reach the
// thing you came to do. The summary is one line now.
//
// Payment stays in the hosted form: card details never reach this application.
// ─────────────────────────────────────────────────────────────────────────────

type Term = '1' | '3'

const TERMS: Record<Term, { years: number; price: number; url: string }> = {
  // Ontraport order forms — both allow framing (verified 2026-06-30). bnId,
  // email and years ride along so the renewal-paid webhook knows which name to
  // extend when the payment lands.
  '1': { years: 1, price: 99, url: 'https://idealbusiness.au/portalpayment' },
  '3': { years: 3, price: 199, url: 'https://idealbusiness.au/portalrenewal3' },
}

export function RenewBusinessNamePage() {
  const { bnId } = useParams<{ bnId: string }>()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const names = useQuery(getBusinessNamesOptions())

  const term: Term = params.get('term') === '3' ? '3' : '1'

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
  const selected = TERMS[term]

  const paymentUrl =
    `${selected.url}?bnId=${encodeURIComponent(name.id ?? '')}` +
    `&email=${encodeURIComponent(user?.email ?? '')}` +
    `&years=${selected.years}` +
    `&firstname=${encodeURIComponent(user?.firstName ?? '')}` +
    `&lastname=${encodeURIComponent(user?.lastName ?? '')}`

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
                · {status.tone === 'overdue' ? 'was due' : 'currently runs to'}{' '}
                {formatDate(name.renewalDate)}
              </>
            ) : null}
          </>
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-lg leading-tight font-semibold text-ink">How long for?</legend>
        <RadioGroup.Root
          value={term}
          onValueChange={(details) => setParams({ term: details.value ?? '1' }, { replace: true })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(TERMS) as Term[]).map((key) => {
              const option = TERMS[key]
              const until = extendedRenewalDate(name.renewalDate, option.years)
              return (
                <RadioGroup.Card key={key} value={key} className="flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <RadioGroup.Dot />
                    <RadioGroup.Text className="text-ink-faint">
                      {option.years} year{option.years > 1 ? 's' : ''}
                    </RadioGroup.Text>
                  </span>

                  {/* The date is what's being bought, so it leads. */}
                  <span className="font-display text-xl leading-tight font-semibold text-ink">
                    Yours until {formatDate(until)}
                  </span>
                  <span className="text-sm text-ink-faint" data-numeric>
                    ${option.price}
                  </span>
                  <RadioGroup.HiddenInput />
                </RadioGroup.Card>
              )
            })}
          </div>
        </RadioGroup.Root>
      </fieldset>

      <Panel className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <PanelTitle as="h2">Payment</PanelTitle>
          <span className="text-sm text-ink-faint">
            <span data-numeric className="text-base font-medium text-ink">
              ${selected.price}
            </span>{' '}
            · {selected.years} year{selected.years > 1 ? 's' : ''}
          </span>
        </div>

        <iframe
          key={term} // remount so the form picks up the new term
          src={paymentUrl}
          title={`Pay $${selected.price} to renew for ${selected.years} year${selected.years > 1 ? 's' : ''}`}
          // Taller on narrow screens, not shorter: the hosted form stacks its
          // fields on a phone, so a fixed 900px left it scrolling inside the
          // frame — a nested scrollbar in the middle of a payment.
          className="min-h-[68rem] w-full border-0 bg-surface sm:min-h-[56rem]"
          loading="lazy"
        />
      </Panel>

      <p className="text-sm text-ink-faint">
        Your renewal date updates automatically once the payment clears, usually within a minute, and the
        renewal appears under{' '}
        <TextLink to="/asic-renewals">Business name renewals completed</TextLink>.
      </p>
    </Page>
  )
}
