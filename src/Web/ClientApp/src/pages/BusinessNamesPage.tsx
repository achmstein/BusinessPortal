import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Download, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  createBusinessNameMutation,
  deleteBusinessNameMutation,
  getAbnLookupStatusOptions,
  getAbnLookupStatusQueryKey,
  getAbnRegisteredNamesOptions,
  getBusinessEntitiesOptions,
  getBusinessNameDocumentsOptions,
  getBusinessNamesOptions,
  getBusinessNamesQueryKey,
  getProfileOptions,
  getProfileQueryKey,
  startAbnLookupMutation,
  requestAsicKeyMutation,
  updateBusinessNameMutation,
  updateProfileMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import type { AbnRegisteredName, BusinessNameDto } from '@/api/generated'
import { renewalStatus } from '@/lib/renewal'
import { formatDate } from '@/lib/dates'
import { formatAbn } from '@/lib/format'
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

const digitsOnly = (value?: string | null) => (value ?? '').replace(/\D/g, '')

const abnSchema = z.object({
  abn: z.string().refine((v) => digitsOnly(v).length === 11, { message: 'An ABN has 11 digits.' }),
})

function BusinessNameFields({
  form,
  onRequestKey,
  requestingKey,
}: {
  form: ReturnType<typeof useForm<BusinessNameForm>>
  /** In the add dialog this saves the name first, then requests. */
  onRequestKey: () => void
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
            onClick={onRequestKey}
          >
            Request ASIC key
          </Button>
        </div>
      </Field>
    </div>
  )
}

/** Where a Renewtron key request stands, in words — null when none is open. */
function keyRequestNote(name: BusinessNameDto): string | null {
  const since = name.asicKeyRequestedAt ? ` on ${formatDate(name.asicKeyRequestedAt)}` : ''
  switch (name.asicKeyRequestStatus) {
    case 'Pending':
    case 'Manual':
      return `ASIC key requested${since} — we’re asking ASIC for it.`
    case 'Submitted':
      return 'ASIC has our request — the key usually arrives within a few business days.'
    case 'KeyReceived':
      return 'Key received — we’re checking it and will add it here shortly.'
    case 'Failed':
      return 'We couldn’t request the key automatically.'
    default:
      return null
  }
}

const fromRegister = (r: AbnRegisteredName): BusinessNameForm => ({
  name: r.name ?? '',
  dateRegistered: r.dateRegistered ?? '',
  renewalDate: r.renewalDate ?? '',
  asicKey: '',
})

/** Names registered to the customer's ABN that aren't on file — one click fills the form. */
function RegisteredNamePicker({
  names,
  selected,
  onPick,
}: {
  names: AbnRegisteredName[]
  selected: string
  onPick: (name: AbnRegisteredName) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <p className="text-sm text-ink-faint">
        {names.length === 1
          ? 'We found this name registered to your ABN and filled it in:'
          : 'Registered to your ABN — pick one to fill in the details:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <Button
            key={n.name}
            type="button"
            size="sm"
            variant={n.name === selected ? 'primary' : 'secondary'}
            aria-pressed={n.name === selected}
            onClick={() => onPick(n)}
          >
            {n.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * ASIC's letters for one name — renewal confirmations, renewal notices, key letters —
 * kept by Renewtron from the inbox ASIC writes to. Only offered once the name's key is
 * on file, since every letter prints it. Fetched when opened, not for every row.
 */
function LettersDialog({ name, onClose }: { name: BusinessNameDto | null; onClose: () => void }) {
  const letters = useQuery({
    ...getBusinessNameDocumentsOptions({ path: { id: name?.id ?? '' } }),
    enabled: Boolean(name?.id),
  })

  return (
    <Dialog
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="ASIC letters"
      description={name?.name ?? undefined}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {letters.isPending ? (
        <RecordList aria-busy="true">
          <RecordSkeleton />
        </RecordList>
      ) : letters.isError ? (
        <ErrorState
          description="We couldn’t load your letters just now."
          action={
            <Button variant="secondary" onClick={() => void letters.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (letters.data ?? []).length === 0 ? (
        <p className="text-sm text-ink-faint">
          No letters yet. When ASIC sends us a renewal confirmation, renewal notice or key letter for this
          name, it will appear here.
        </p>
      ) : (
        <RecordList>
          {letters.data!.map((letter) => (
            <Record key={letter.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="font-medium text-ink">{letter.title}</p>
                <p className="text-sm text-ink-faint">Received {formatDate(letter.receivedAt)}</p>
              </div>
              <a
                href={`/api/business-names/${name!.id}/documents/${letter.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline"
              >
                <Download aria-hidden className="size-4" />
                Download PDF
              </a>
            </Record>
          ))}
        </RecordList>
      )}
    </Dialog>
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
  const [askingAbn, setAskingAbn] = useState(false)
  const [viewingLetters, setViewingLetters] = useState<BusinessNameDto | null>(null)

  const names = useQuery(getBusinessNamesOptions())
  const profile = useQuery(getProfileOptions())
  const entities = useQuery(getBusinessEntitiesOptions())

  // The ABNs the lookup will search: the one on "Your details" plus each business's.
  const abnsOnFile = [
    ...new Set([profile.data?.abn, ...(entities.data ?? []).map((e) => e.abn)].map(digitsOnly)),
  ].filter((abn) => abn.length === 11)
  const abnsKnown = profile.isSuccess && entities.isSuccess

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

  // Names registered to the ABN on file, fetched when the add dialog opens, so
  // it arrives filled in rather than blank.
  const registered = useQuery({
    ...getAbnRegisteredNamesOptions(),
    enabled: adding && abnsOnFile.length > 0,
    staleTime: 5 * 60_000,
  })
  const suggestions = registered.data ?? []

  const addForm = useForm<BusinessNameForm>({
    resolver: zodResolver(businessNameSchema),
    defaultValues: EMPTY_FORM,
  })
  const editForm = useForm<BusinessNameForm>({
    resolver: zodResolver(businessNameSchema),
    defaultValues: EMPTY_FORM,
  })

  // Fill from the first suggestion once they arrive, unless the customer has
  // already started typing.
  useEffect(() => {
    if (adding && suggestions.length > 0 && !addForm.formState.isDirty && !addForm.getValues('name'))
      addForm.reset(fromRegister(suggestions[0]))
  }, [adding, suggestions, addForm])

  // The Overview's "Add names" lands here with ?add=1: go straight to the form.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('add') !== '1') return
    setAdding(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const create = useMutation({
    ...createBusinessNameMutation(),
    onSuccess: async () => {
      await invalidate()
      await queryClient.invalidateQueries({ queryKey: getAbnRegisteredNamesOptions().queryKey })
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
    onError: (error) =>
      toastError('Could not start the lookup', (error as { error?: string } | undefined)?.error ?? 'Try again shortly.'),
  })

  // With no ABN on file there's nothing to search, so ask for one first rather
  // than run a lookup that can only report "no new names".
  function checkAbnLookup() {
    if (abnsKnown && abnsOnFile.length === 0) setAskingAbn(true)
    else startLookup.mutate({})
  }

  const abnForm = useForm<z.infer<typeof abnSchema>>({ resolver: zodResolver(abnSchema), defaultValues: { abn: '' } })

  // The ABN is kept on "Your details", so it's saved there before the lookup runs.
  const saveAbn = useMutation({
    ...updateProfileMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getProfileQueryKey() })
      setAskingAbn(false)
      abnForm.reset({ abn: '' })
      startLookup.mutate({})
    },
    onError: () => toastError('We couldn’t save your ABN', 'Try again in a moment.'),
  })

  const submitAbn = abnForm.handleSubmit(({ abn }) =>
    saveAbn.mutate({ body: { ...profile.data!, abn: digitsOnly(abn) } }),
  )

  // Renewtron asks ASIC for a copy of the key and reads it from ASIC's reply;
  // the portal's sync brings it back onto the name.
  const requestKey = useMutation({
    ...requestAsicKeyMutation(),
    onSuccess: async () => {
      await invalidate()
      toastSuccess('ASIC key requested', 'We’ve asked ASIC for a copy — it’ll appear here when it arrives.')
    },
    onError: (error) =>
      toastError('Couldn’t request the key', (error as { error?: string } | undefined)?.error ?? 'Try again in a moment.'),
  })

  function requestAsicKey(id: string) {
    requestKey.mutate({ path: { id } })
  }

  // From the add dialog the name doesn't exist yet: save it first, then ask.
  const addAndRequestKey = addForm.handleSubmit(async (values) => {
    const created = await create.mutateAsync({ body: values })
    if (created?.id) requestAsicKey(created.id)
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
    <Page
      title="Your business names"
      description="Every name you hold with ASIC, and when each one next needs renewing."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={checkAbnLookup}
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

      {running ? (
        <LookupProgress job={lookup.data ?? {}} />
      ) : abnsOnFile.length > 0 ? (
        <p className="text-sm text-ink-faint">
          ABN Lookup searches {abnsOnFile.length === 1 ? 'ABN' : 'ABNs'}{' '}
          <span data-numeric>{abnsOnFile.map(formatAbn).join(', ')}</span>.
        </p>
      ) : null}

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
              <Button variant="secondary" onClick={checkAbnLookup} loading={startLookup.isPending}>
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
                      <Menu.Trigger aria-label={`More options for ${name.name}`} className="p-1.5">
                        <MoreHorizontal aria-hidden className="size-4" />
                      </Menu.Trigger>
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
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
                    <span data-numeric>ASIC key {name.asicKey}</span>
                    <button
                      type="button"
                      className="font-medium text-accent-700 hover:underline"
                      onClick={() => setViewingLetters(name)}
                    >
                      ASIC letters
                    </button>
                  </p>
                ) : keyRequestNote(name) ? (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
                    {keyRequestNote(name)}
                    {name.asicKeyRequestStatus === 'Failed' ? (
                      <button
                        type="button"
                        className="font-medium text-accent-700 hover:underline disabled:opacity-50"
                        disabled={requestKey.isPending}
                        onClick={() => requestAsicKey(name.id!)}
                      >
                        Try again
                      </button>
                    ) : null}
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
                    No ASIC key on file.
                    <button
                      type="button"
                      className="font-medium text-accent-700 hover:underline disabled:opacity-50"
                      disabled={requestKey.isPending}
                      onClick={() => requestAsicKey(name.id!)}
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
          {suggestions.length > 0 ? (
            <RegisteredNamePicker
              names={suggestions}
              selected={addForm.watch('name').trim()}
              onPick={(n) => addForm.reset(fromRegister(n))}
            />
          ) : null}
          <BusinessNameFields
            form={addForm}
            onRequestKey={() => void addAndRequestKey()}
            requestingKey={create.isPending || requestKey.isPending}
          />
        </form>
      </Dialog>

      {/* ── ABN, when none is on file ── */}
      <Dialog
        open={askingAbn}
        onOpenChange={(open) => {
          setAskingAbn(open)
          if (!open) abnForm.reset({ abn: '' })
        }}
        title="What’s your ABN?"
        description="We’ll find the business names registered to it. It’s saved to Your details."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskingAbn(false)}>
              Cancel
            </Button>
            <Button loading={saveAbn.isPending} onClick={() => void submitAbn()}>
              Find my names
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void submitAbn(e)} noValidate>
          <Field label="ABN" hint="11 digits" required error={abnForm.formState.errors.abn?.message}>
            <Field.Input inputMode="numeric" autoComplete="off" autoFocus {...abnForm.register('abn')} />
          </Field>
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
          <BusinessNameFields
            form={editForm}
            onRequestKey={() => editing?.id && requestAsicKey(editing.id)}
            requestingKey={requestKey.isPending}
          />
        </form>
      </Dialog>

      {/* ── ASIC letters ── */}
      <LettersDialog name={viewingLetters} onClose={() => setViewingLetters(null)} />

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
