import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createBusinessNameMutation,
  deleteBusinessNameMutation,
  getAbnLookupStatusOptions,
  getAbnLookupStatusQueryKey,
  getBusinessNamesOptions,
  getBusinessNamesQueryKey,
  startAbnLookupMutation,
  startThreadMutation,
  updateBusinessNameMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import type { BusinessNameDto } from '@/api/generated'
import { renewalStatus } from '@/lib/renewal'
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Menu,
  toastError,
  toastSuccess,
  Page,
  Panel,
  Progress,
  Record,
  RecordTitle,
  RecordList,
  RecordSkeleton,
  Tooltip,
  ValidityBand,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The thesis screen. A register is a list of entries, so this is a spine of
// hairline-separated records rather than a grid of cards, and each record leads
// with the one fact the customer came for: how long this name has left.
//
// Editing moved out of an inline <details> accordion (which had no
// aria-expanded and used a decorative ▾ as its only affordance) into a proper
// dialog, and removal now asks first.
// ─────────────────────────────────────────────────────────────────────────────

// Optional fields are empty strings rather than undefined: the API's commands
// take non-nullable strings, and "" round-trips as "not supplied".
const businessNameSchema = z.object({
  name: z.string().trim().min(1, 'Enter the business name as ASIC has it registered.'),
  dateRegistered: z.string(),
  renewalDate: z.string(),
  asicKey: z.string(),
})

type BusinessNameForm = z.infer<typeof businessNameSchema>

const EMPTY_FORM: BusinessNameForm = { name: '', dateRegistered: '', renewalDate: '', asicKey: '' }

function BusinessNameFields({
  form,
  onRequestKey,
  requestingKey,
}: {
  form: ReturnType<typeof useForm<BusinessNameForm>>
  onRequestKey: (name: string) => void
  requestingKey: boolean
}) {
  const { control, register, formState, watch } = form
  const name = watch('name').trim()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Business name"
        required
        error={formState.errors.name?.message}
        className="sm:col-span-2"
      >
        <Field.Input {...register('name')} placeholder="e.g. Acme Plumbing Co" />
      </Field>
      {/* Controller rather than register: the picker's value is a controlled
          ISO string, not a DOM event on an <input>. */}
      <Field label="Date registered" error={formState.errors.dateRegistered?.message}>
        <Controller
          control={control}
          name="dateRegistered"
          render={({ field, fieldState }) => (
            <DatePicker
              value={field.value ?? ''}
              onChange={field.onChange}
              invalid={Boolean(fieldState.error)}
            />
          )}
        />
      </Field>
      <Field label="Renewal date" error={formState.errors.renewalDate?.message}>
        <Controller
          control={control}
          name="renewalDate"
          render={({ field, fieldState }) => (
            <DatePicker
              value={field.value ?? ''}
              onChange={field.onChange}
              invalid={Boolean(fieldState.error)}
            />
          )}
        />
      </Field>
      <Field
        label="ASIC key"
        hint="If unknown, you can request a copy be emailed to you."
        error={formState.errors.asicKey?.message}
        className="sm:col-span-2"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field.Input {...register('asicKey')} placeholder="ASIC key for online services" />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            disabled={name.length === 0}
            loading={requestingKey}
            onClick={() => onRequestKey(name)}
          >
            Request ASIC key
          </Button>
        </div>
      </Field>
    </div>
  )
}

function LookupProgress({ job }: { job: { status?: string; totalAbns?: number | string; abnsProcessed?: number | string } }) {
  const total = Number(job.totalAbns) || 0
  const done = Number(job.abnsProcessed) || 0
  return (
    <Panel className="flex flex-col gap-3" aria-live="polite">
      <Progress
        value={done}
        max={total}
        label="Checking your ABNs with ABN Lookup"
        valueText={`${done} of ${total}`}
      />
      <p className="text-sm text-ink-faint">
        This runs in the background — you can leave this page and come back.
      </p>
    </Panel>
  )
}

export function BusinessNamesPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<BusinessNameDto | null>(null)
  const [removing, setRemoving] = useState<BusinessNameDto | null>(null)
  const [adding, setAdding] = useState(false)

  const names = useQuery(getBusinessNamesOptions())

  const lookup = useQuery({
    ...getAbnLookupStatusOptions(),
    // Poll only while work is actually in flight, then stop. The old version
    // ran a bare 4-second setInterval regardless of state.
    refetchInterval: (query) => (query.state.data?.status === 'Running' ? 4000 : false),
  })

  const running = lookup.data?.status === 'Running'

  // When the lookup finishes it has added or enriched names, so the list is stale.
  // The result is announced once, as a toast, only when we watched it finish —
  // the old page re-showed a "finished" banner on every visit however many
  // times it was dismissed.
  const lastStatus = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = lookup.data?.status
    if (lookup.data && status !== 'Running') {
      void queryClient.invalidateQueries({ queryKey: getBusinessNamesQueryKey() })
      if (lastStatus.current === 'Running') {
        const added = Number(lookup.data.addedCount) || 0
        if (status === 'Failed') toastError('ABN Lookup failed', lookup.data.error || 'Try again shortly.')
        else
          toastSuccess(
            'ABN Lookup finished',
            added > 0 ? `Added ${added} new business name${added === 1 ? '' : 's'}.` : 'No new business names to add.',
          )
      }
    }
    lastStatus.current = status
  }, [lookup.data, queryClient])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getBusinessNamesQueryKey() })

  const addForm = useForm<BusinessNameForm>({
    resolver: zodResolver(businessNameSchema),
    defaultValues: EMPTY_FORM,
  })
  const editForm = useForm<BusinessNameForm>({
    resolver: zodResolver(businessNameSchema),
    defaultValues: EMPTY_FORM,
  })

  const create = useMutation({
    ...createBusinessNameMutation(),
    onSuccess: async () => {
      await invalidate()
      addForm.reset(EMPTY_FORM)
      setAdding(false)
      toastSuccess('Business name added')
    },
    onError: () => toastError('Could not add that name', 'Check the details and try again.'),
  })

  const update = useMutation({
    ...updateBusinessNameMutation(),
    onSuccess: async () => {
      await invalidate()
      setEditing(null)
      toastSuccess('Changes saved')
    },
    onError: () => toastError('Could not save your changes', 'Check the details and try again.'),
  })

  const remove = useMutation({
    ...deleteBusinessNameMutation(),
    onSuccess: async () => {
      await invalidate()
      setRemoving(null)
      toastSuccess('Business name removed')
    },
    onError: () => toastError('Could not remove that name', 'Try again in a moment.'),
  })

  const startLookup = useMutation({
    ...startAbnLookupMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getAbnLookupStatusQueryKey() })
      toastSuccess('Looking up your business names', 'This runs in the background.')
    },
    onError: () => toastError('Could not start the lookup', 'Try again shortly.'),
  })

  // Goes to the support inbox; the team asks ASIC to email the key to the
  // holder's registered address.
  const requestKey = useMutation({
    ...startThreadMutation(),
    onSuccess: () =>
      toastSuccess('ASIC key requested', 'We’ll arrange for a copy to be emailed to you.'),
    onError: () => toastError('Couldn’t send the request', 'Try again in a moment.'),
  })

  function requestAsicKey(name: string) {
    requestKey.mutate({
      body: {
        subject: `ASIC key request — ${name}`,
        body: `I don’t have the ASIC key for the business name "${name}". Please request a copy be emailed to me.`,
      },
    })
  }

  function openEdit(name: BusinessNameDto) {
    editForm.reset({
      name: name.name ?? '',
      dateRegistered: name.dateRegistered ?? '',
      renewalDate: name.renewalDate ?? '',
      asicKey: name.asicKey ?? '',
    })
    setEditing(name)
  }

  const list = [...(names.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  const dueCount = list.filter((b) => renewalStatus(b.renewalDate).needsAction).length

  return (
    <Page
      title="Your business names"
      description="Every name you hold with ASIC, and when each one next needs renewing."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => startLookup.mutate({})}
            loading={startLookup.isPending || running}
          >
            <RefreshCw aria-hidden className="size-4" />
            {running ? 'Checking…' : 'Check ABN Lookup'}
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Add a name
          </Button>
        </>
      }
    >

      {running ? <LookupProgress job={lookup.data ?? {}} /> : null}

      {dueCount > 0 ? (
        <p className="text-sm text-warn-700">
          {dueCount === 1 ? 'One name needs' : `${dueCount} names need`} renewing soon.
        </p>
      ) : null}

      {names.isPending ? (
        <RecordList aria-busy="true">
          <RecordSkeleton />
          <RecordSkeleton />
        </RecordList>
      ) : names.isError ? (
        // Distinct from the empty state on purpose: a failed request used to
        // render as "No business names added yet."
        <ErrorState
          description="We couldn’t load your business names just now."
          action={
            <Button variant="secondary" onClick={() => void names.refetch()}>
              Try again
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="No business names yet"
          description="Add a name you hold with ASIC, or let us find them from your ABN."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setAdding(true)}>Add a name</Button>
              <Button variant="secondary" onClick={() => startLookup.mutate({})} loading={startLookup.isPending}>
                Check ABN Lookup
              </Button>
            </div>
          }
        />
      ) : (
        <RecordList>
          {list.map((name) => {
            const status = renewalStatus(name.renewalDate)
            return (
              <Record key={name.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <RecordTitle className="min-w-0 flex-1">
                    {name.name}
                  </RecordTitle>
                  <div className="flex shrink-0 items-center gap-3">
                    {status.needsAction ? (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    ) : (
                      <span className="text-sm text-ink-faint">{status.label}</span>
                    )}
                    <Menu.Root>
                      <Tooltip label="More options">
                        <Menu.Trigger aria-label={`More options for ${name.name}`} className="p-1.5">
                          <MoreHorizontal aria-hidden className="size-4" />
                        </Menu.Trigger>
                      </Tooltip>
                      <Menu.Content>
                        <Menu.Item value="edit" onSelect={() => openEdit(name)}>
                          <Pencil aria-hidden className="size-4" />
                          Edit this business name
                        </Menu.Item>
                        <Menu.Item value="remove" tone="danger" onSelect={() => setRemoving(name)}>
                          <Trash2 aria-hidden className="size-4" />
                          Remove from the portal…
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Root>
                  </div>
                </div>

                {name.asicKey ? (
                  <p className="text-sm text-ink-faint" data-numeric>
                    ASIC key {name.asicKey}
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
                    No ASIC key on file.
                    <button
                      type="button"
                      className="font-medium text-accent-700 hover:underline disabled:opacity-50"
                      disabled={requestKey.isPending}
                      onClick={() => requestAsicKey(name.name ?? '')}
                    >
                      Request ASIC key
                    </button>
                  </p>
                )}

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

      {/* ── Add ── */}
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          setAdding(open)
          if (!open) addForm.reset(EMPTY_FORM)
        }}
        title="Add a business name"
        description="Enter it exactly as ASIC has it registered."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={addForm.handleSubmit((values) => create.mutate({ body: values }))}
            >
              Add name
            </Button>
          </>
        }
      >
        <form onSubmit={addForm.handleSubmit((values) => create.mutate({ body: values }))}>
          <BusinessNameFields form={addForm} onRequestKey={requestAsicKey} requestingKey={requestKey.isPending} />
        </form>
      </Dialog>

      {/* ── Edit ── */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title="Edit business name"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              onClick={editForm.handleSubmit((values) =>
                update.mutate({ path: { id: editing!.id! }, body: { id: editing!.id!, ...values } }),
              )}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form
          onSubmit={editForm.handleSubmit((values) =>
            update.mutate({ path: { id: editing!.id! }, body: { id: editing!.id!, ...values } }),
          )}
        >
          <BusinessNameFields form={editForm} onRequestKey={requestAsicKey} requestingKey={requestKey.isPending} />
        </form>
      </Dialog>

      {/* ── Remove ── */}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this business name?"
        description={
          <>
            <strong className="text-ink">{removing?.name}</strong> will be removed from your portal. This
            doesn’t cancel the registration with ASIC.
          </>
        }
        confirmLabel="Remove name"
        loading={remove.isPending}
        onConfirm={() => remove.mutate({ path: { id: removing!.id! } })}
      />
    </Page>
  )
}
