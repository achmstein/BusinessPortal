import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import {
  createBusinessEntityMutation,
  deleteBusinessEntityMutation,
  getBusinessEntitiesOptions,
  getBusinessEntitiesQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import type { BusinessEntityDto, EntityType } from '@/api/generated'
import { formatAbn, formatAcn, maskTfn } from '@/lib/format'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Record,
  RecordList,
  RecordSkeleton,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The businesses behind the business names — reference data that feeds the ATO
// sync and sits underneath renewals. Most people have one or two.
//
// What changed and why:
//
//  · The eight-field add form no longer sits permanently under the list. Most
//    visits here are to check a number, not to add a business.
//  · Removal asks first, and says something different when the record came from
//    the ATO: those carry a TFN and tax account details that were never typed
//    in by hand and can't be retyped from memory.
//  · Where a record came from is now visible. An ATO-synced business and one
//    someone typed looked identical, which mattered precisely when deciding
//    whether deleting it was safe.
//  · ABNs and ACNs are grouped the way they're printed, because people read
//    them back against a letter from the ATO or ASIC.
//  · TFNs are masked. There was no reason to paint one in full on a screen.
// ─────────────────────────────────────────────────────────────────────────────

const ENTITY_TYPES: EntityType[] = ['Unspecified', 'SoleTrader', 'Partnership', 'Company', 'Trust']

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Unspecified: 'Not specified',
  SoleTrader: 'Sole trader',
  Partnership: 'Partnership',
  Company: 'Company',
  Trust: 'Trust',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the business name.'),
  entityType: z.string(),
  abn: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 0 || v.replace(/\D/g, '').length === 11, {
      message: 'An ABN has 11 digits.',
    }),
  acn: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 0 || v.replace(/\D/g, '').length === 9, {
      message: 'An ACN has 9 digits.',
    }),
  industry: z.string(),
  // Not z.coerce here: coercion gives the schema a different input and output
  // type, which react-hook-form's resolver can't reconcile. The input is
  // registered with valueAsNumber instead, so both sides stay `number`.
  employees: z.number().min(0, 'That can’t be negative.'),
  phone: z.string(),
  website: z.string(),
})

type EntityForm = z.infer<typeof schema>

const EMPTY: EntityForm = {
  name: '',
  entityType: 'Unspecified',
  abn: '',
  acn: '',
  industry: '',
  employees: 0,
  phone: '',
  website: '',
}

export function BusinessPage() {
  const queryClient = useQueryClient()
  const entities = useQuery(getBusinessEntitiesOptions())
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<BusinessEntityDto | null>(null)

  const form = useForm<EntityForm>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getBusinessEntitiesQueryKey() })

  const create = useMutation({
    ...createBusinessEntityMutation(),
    onSuccess: async () => {
      await invalidate()
      form.reset(EMPTY)
      setAdding(false)
      toastSuccess('Business added')
    },
    onError: () => toastError('Couldn’t add that business', 'Check the details and try again.'),
  })

  const remove = useMutation({
    ...deleteBusinessEntityMutation(),
    onSuccess: async () => {
      await invalidate()
      setRemoving(null)
      toastSuccess('Business removed')
    },
    onError: () => toastError('Couldn’t remove that business', 'Try again in a moment.'),
  })

  const list = entities.data ?? []
  const fromAto = removing?.source === 'Ato'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your businesses"
        description="The entities behind your business names. We use these when syncing with the ATO."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Add a business
          </Button>
        }
      />

      {entities.isPending ? (
        <RecordList aria-busy="true">
          <RecordSkeleton />
          <RecordSkeleton />
        </RecordList>
      ) : entities.isError ? (
        <ErrorState
          description="We couldn’t load your businesses just now."
          action={
            <Button variant="secondary" onClick={() => void entities.refetch()}>
              Try again
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Add the business behind your business names, or connect the ATO and we’ll bring them across for you."
          action={<Button onClick={() => setAdding(true)}>Add a business</Button>}
        />
      ) : (
        <RecordList>
          {list.map((entity) => (
            <Record key={entity.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl leading-tight font-medium text-ink">
                    {entity.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-sage">
                    {ENTITY_TYPE_LABELS[entity.entityType ?? 'Unspecified'] ?? entity.entityType}
                    {entity.industry ? ` · ${entity.industry}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {entity.source === 'Ato' ? <Badge tone="ok">From the ATO</Badge> : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${entity.name}`}
                    onClick={() => setRemoving(entity)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {entity.abn ? (
                  <div>
                    <dt className="text-xs tracking-[0.08em] text-sage uppercase">ABN</dt>
                    <dd className="text-ink" data-numeric>
                      {formatAbn(entity.abn)}
                    </dd>
                  </div>
                ) : null}
                {entity.acn ? (
                  <div>
                    <dt className="text-xs tracking-[0.08em] text-sage uppercase">ACN</dt>
                    <dd className="text-ink" data-numeric>
                      {formatAcn(entity.acn)}
                    </dd>
                  </div>
                ) : null}
                {entity.tfn ? (
                  <div>
                    <dt className="text-xs tracking-[0.08em] text-sage uppercase">TFN</dt>
                    <dd className="text-ink" data-numeric>
                      {maskTfn(entity.tfn)}
                    </dd>
                  </div>
                ) : null}
                {Number(entity.employees) > 0 ? (
                  <div>
                    <dt className="text-xs tracking-[0.08em] text-sage uppercase">Employees</dt>
                    <dd className="text-ink" data-numeric>
                      {entity.employees}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Record>
          ))}
        </RecordList>
      )}

      <Dialog
        open={adding}
        onOpenChange={(open) => {
          setAdding(open)
          if (!open) form.reset(EMPTY)
        }}
        title="Add a business"
        description="Only the name is required — the ATO sync can fill in the rest."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={form.handleSubmit((values) =>
                create.mutate({ body: { ...values, entityType: values.entityType as EntityType } }),
              )}
            >
              Add business
            </Button>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) =>
            create.mutate({ body: { ...values, entityType: values.entityType as EntityType } }),
          )}
          noValidate
        >
          <Field
            label="Business name"
            required
            className="sm:col-span-2"
            error={form.formState.errors.name?.message}
          >
            <Field.Input {...form.register('name')} />
          </Field>
          <Field label="Type">
            <Field.Select {...form.register('entityType')}>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
                </option>
              ))}
            </Field.Select>
          </Field>
          <Field label="Industry" error={form.formState.errors.industry?.message}>
            <Field.Input {...form.register('industry')} placeholder="e.g. Plumbing" />
          </Field>
          <Field label="ABN" hint="11 digits" error={form.formState.errors.abn?.message}>
            <Field.Input inputMode="numeric" {...form.register('abn')} />
          </Field>
          <Field
            label="ACN"
            hint="9 digits, companies only"
            error={form.formState.errors.acn?.message}
          >
            <Field.Input inputMode="numeric" {...form.register('acn')} />
          </Field>
          <Field label="Employees" error={form.formState.errors.employees?.message}>
            <Field.Input type="number" min={0} {...form.register('employees', { valueAsNumber: true })} />
          </Field>
          <Field label="Phone" error={form.formState.errors.phone?.message}>
            <Field.Input type="tel" {...form.register('phone')} />
          </Field>
          <Field label="Website" className="sm:col-span-2" error={form.formState.errors.website?.message}>
            <Field.Input {...form.register('website')} placeholder="yourbusiness.com.au" />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove this business?"
        description={
          fromAto ? (
            <>
              <strong className="text-ink">{removing?.name}</strong> came from the ATO, along with its tax
              file number and tax account details. Removing it here deletes those — you’d need to connect
              and sync again to get them back.
            </>
          ) : (
            <>
              <strong className="text-ink">{removing?.name}</strong> will be removed from your portal. This
              doesn’t change anything with the ATO or ASIC.
            </>
          )
        }
        confirmLabel="Remove business"
        loading={remove.isPending}
        onConfirm={() => remove.mutate({ path: { id: removing!.id! } })}
      />
    </div>
  )
}
