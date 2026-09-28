import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  cancelBusinessNameMutation,
  getBusinessNamesOptions,
  getBusinessNamesQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { formatDate } from '@/lib/dates'
import {
  Button,
  Checkbox,
  ErrorState,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  RadioGroup,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Cancelling a business name is rare, irreversible, and costs the customer
// something real — the name can be registered by someone else afterwards. So
// this page is a confirmation, and the whole design is about making the
// consequence concrete before the button is available.
//
// The payment step is gone. It collected a cardholder name, full card number,
// expiry and CCV, validated their shape server-side and then discarded them —
// nothing was ever charged. It was labelled a demo but sat on a live route, so
// it was pure risk: real customers' card details in request bodies and logs, in
// exchange for nothing. Renewals already take money the right way, through a
// hosted form; if a cancellation fee is wanted it belongs there too.
//
// Deliberately not a type-the-name-to-confirm gate: that pattern reads as a
// puzzle to the people who use this portal. A plain acknowledgement and a button
// that names the business name is clearer and just as deliberate.
// ─────────────────────────────────────────────────────────────────────────────

type Scope = 'name' | 'name_and_abn'

const OPTIONS: { value: Scope; title: string; detail: string }[] = [
  {
    value: 'name',
    title: 'Just the business name',
    detail: 'Your ABN stays active, so you can keep trading under your own name or register a new one.',
  },
  {
    value: 'name_and_abn',
    title: 'The business name and the ABN',
    detail:
      'We’ll cancel the name and raise the ABN cancellation with our team, who action it with the ATO and confirm in Messages.',
  },
]

export function CancelBusinessNamePage() {
  const { bnId } = useParams<{ bnId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const names = useQuery(getBusinessNamesOptions())
  const [scope, setScope] = useState<Scope>('name')
  const [acknowledged, setAcknowledged] = useState(false)

  const cancel = useMutation({
    ...cancelBusinessNameMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getBusinessNamesQueryKey() })
      toastSuccess('Business name cancelled', 'It’s been removed from your portal.')
      navigate('/asic-renewals', { replace: true })
    },
    onError: () => toastError('We couldn’t cancel that name', 'Nothing has changed. Try again in a moment.'),
  })

  const back = { to: '/asic-renewals', label: 'Back to renewals' }

  if (names.isPending) {
    return (
      <Page title="Cancel this business name" back={back}>
        <PageSkeleton />
      </Page>
    )
  }

  if (names.isError) {
    return (
      <Page title="Cancel this business name" back={back}>
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

  return (
    <Page title="Cancel this business name" description={name.name ?? undefined} back={back}>

      <div className="flex flex-col gap-2 rounded-sm border-l-2 border-danger-600 bg-danger-50/60 px-5 py-4">
        <h2 className="font-display text-lg leading-tight font-semibold text-danger-700">This can’t be undone</h2>
        <p className="text-sm leading-relaxed text-danger-600">
          Once <strong className="font-medium">{name.name}</strong> is cancelled you can’t trade under it,
          and anyone else is free to register it. Getting it back means registering again from scratch — and
          only if it’s still available.
          {name.renewalDate ? (
            <> Its current registration runs until {formatDate(name.renewalDate)}.</>
          ) : null}
        </p>
      </div>

      <Panel className="flex flex-col gap-4">
        <PanelTitle as="h2">What should we cancel?</PanelTitle>

        <RadioGroup.Root value={scope} onValueChange={(details) => setScope(details.value as Scope)}>
          <div className="flex flex-col gap-3">
            {OPTIONS.map((option) => (
              <RadioGroup.Card key={option.value} value={option.value} className="items-start gap-3">
                <RadioGroup.Dot className="mt-0.5" />
                <span className="flex flex-col gap-1">
                  <RadioGroup.Text className="font-medium">{option.title}</RadioGroup.Text>
                  <span className="text-sm leading-relaxed text-ink-faint">{option.detail}</span>
                </span>
                <RadioGroup.HiddenInput />
              </RadioGroup.Card>
            ))}
          </div>
        </RadioGroup.Root>
      </Panel>

      <Checkbox checked={acknowledged} onCheckedChange={setAcknowledged}>
        I understand this is permanent and that {name.name} may be registered by someone else afterwards.
      </Checkbox>

      <div className="flex flex-wrap justify-end gap-3 border-t border-rule pt-4">
        <Button asChild variant="ghost">
          <Link to="/asic-renewals">Keep this name</Link>
        </Button>
        <Button
          variant="danger"
          disabled={!acknowledged}
          loading={cancel.isPending}
          onClick={() => cancel.mutate({ path: { id: name.id! }, body: { scope } })}
        >
          Cancel {name.name}
        </Button>
      </div>
    </Page>
  )
}
