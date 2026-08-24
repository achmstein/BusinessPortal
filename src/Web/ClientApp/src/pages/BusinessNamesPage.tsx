import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createBusinessNameMutation,
  deleteBusinessNameMutation,
  getAbnLookupStatusOptions,
  getAbnLookupStatusQueryKey,
  getBusinessNamesOptions,
  getBusinessNamesQueryKey,
  startAbnLookupMutation,
  updateBusinessNameMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import type { BusinessNameDto } from '@/api/generated'
import { renewalStatus } from '@/lib/renewal'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Panel,
  PanelTitle,
  Record,
  RecordList,
  RecordSkeleton,
  ValidityBand,
  toastError,
  toastSuccess,
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
}: {
  form: ReturnType<typeof useForm<BusinessNameForm>>
}) {
  const { register, formState } = form
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
      <Field label="Date registered" error={formState.errors.dateRegistered?.message}>
        <Field.Input type="date" {...register('dateRegistered')} />
      </Field>
      <Field label="Renewal date" error={formState.errors.renewalDate?.message}>
        <Field.Input type="date" {...register('renewalDate')} />
      </Field>
      <Field
        label="ASIC key"
        hint="Leave blank if you don’t have it — ASIC emails it to you."
        error={formState.errors.asicKey?.message}
        className="sm:col-span-2"
      >
        <Field.Input {...register('asicKey')} placeholder="ASIC key for online services" />
      </Field>
    </div>
  )
}

function LookupProgress({ job }: { job: { status?: string; totalAbns?: number | string; abnsProcessed?: number | string } }) {
  const total = Number(job.totalAbns) || 0
  const done = Number(job.abnsProcessed) || 0
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Panel className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <PanelTitle as="h2" className="text-lg">
          Checking your ABNs with ABN Lookup
        </PanelTitle>
        <span className="text-sm text-sage" data-numeric>
          {done} of {total}
        </span>
      </div>
      <div className="h-px w-full bg-rule-firm">
        <div className="h-px bg-bottle-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-sage">
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
  useEffect(() => {
    if (lookup.data && lookup.data.status !== 'Running') {
      void queryClient.invalidateQueries({ queryKey: getBusinessNamesQueryKey() })
    }
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
    <div className="flex flex-col gap-6">
      <PageHeader
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
      />

      {running ? <LookupProgress job={lookup.data ?? {}} /> : null}

      {dueCount > 0 ? (
        <p className="text-sm text-brass-700">
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
                  <h2 className="font-display min-w-0 flex-1 text-2xl leading-tight font-medium text-ink">
                    {name.name}
                  </h2>
                  <div className="flex shrink-0 items-center gap-3">
                    {status.needsAction ? (
                      <Badge tone={status.tone}>{status.label}</Badge>
                    ) : (
                      <span className="text-sm text-sage">{status.label}</span>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${name.name}`}
                        onClick={() => openEdit(name)}
                      >
                        <Pencil aria-hidden className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${name.name}`}
                        onClick={() => setRemoving(name)}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {name.asicKey ? (
                  <p className="text-sm text-sage" data-numeric>
                    ASIC key {name.asicKey}
                  </p>
                ) : null}

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
          <BusinessNameFields form={addForm} />
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
          <BusinessNameFields form={editForm} />
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
    </div>
  )
}
