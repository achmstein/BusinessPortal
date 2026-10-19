import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  createBusinessEntityMutation,
  getBusinessEntitiesOptions,
  getBusinessEntitiesQueryKey,
  getProfileOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import type { EntityType } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { Button, Dialog, Field, Select, toastError, toastSuccess } from '@/ui'

// The first thing a new customer sees. Their account was made for them when they
// paid for a renewal, and a business name isn't the business that holds it — so
// rather than guessing, ask what kind of business it is and what it's called.
// Shown while they have no business on file; closing it puts it away on this
// browser, and the Business page is always there to do the same later.

const TYPES: { value: EntityType; label: string }[] = [
  { value: 'SoleTrader', label: 'Sole trader' },
  { value: 'Company', label: 'Company' },
  { value: 'Trust', label: 'Trust' },
  { value: 'Partnership', label: 'Partnership' },
]

const NAME_LABELS: Record<string, string> = {
  Company: 'Company name',
  Trust: 'Trust name',
  Partnership: 'Partnership name',
}

const schema = z
  .object({
    entityType: z.string().min(1, 'Choose the type of business.'),
    name: z.string().trim(),
    trusteeName: z.string().trim(),
    abn: z.string().refine((v) => [0, 11].includes(v.replace(/\D/g, '').length), {
      message: 'An ABN has 11 digits.',
    }),
  })
  .superRefine((values, ctx) => {
    if (values.entityType && values.entityType !== 'SoleTrader' && values.name.length === 0)
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter the name.' })
    if (values.entityType === 'Trust' && values.trusteeName.length === 0)
      ctx.addIssue({ code: 'custom', path: ['trusteeName'], message: 'Enter the trustee’s name.' })
  })

type WelcomeForm = z.infer<typeof schema>

const dismissedKey = (userId: string) => `welcome-dismissed:${userId}`

function wasDismissed(userId: string) {
  try {
    return localStorage.getItem(dismissedKey(userId)) === '1'
  } catch {
    return false
  }
}

export function WelcomeDialog() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const customer = Boolean(user && !user.isAdmin && !user.impersonating)
  const entities = useQuery({ ...getBusinessEntitiesOptions(), enabled: customer })
  const profile = useQuery({ ...getProfileOptions(), enabled: customer })
  const [closed, setClosed] = useState(() => (user ? wasDismissed(user.id) : true))

  const form = useForm<WelcomeForm>({
    resolver: zodResolver(schema),
    values: { entityType: '', name: '', trusteeName: '', abn: profile.data?.abn ?? '' },
    resetOptions: { keepDirtyValues: true },
  })
  const entityType = form.watch('entityType')

  function close() {
    try {
      if (user) localStorage.setItem(dismissedKey(user.id), '1')
    } catch {
      // Private window: it just comes back next visit.
    }
    setClosed(true)
  }

  const create = useMutation({
    ...createBusinessEntityMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getBusinessEntitiesQueryKey() })
      close()
      toastSuccess('Thanks — your business is saved', 'You can change it any time on the Business page.')
    },
    onError: () => toastError('Couldn’t save your business', 'Check the details and try again.'),
  })

  function submit(values: WelcomeForm) {
    const soleTrader = values.entityType === 'SoleTrader'
    const ownName = [profile.data?.firstName, profile.data?.lastName].filter(Boolean).join(' ')
    create.mutate({
      body: {
        name: soleTrader ? ownName || 'Sole trader' : values.name,
        entityType: values.entityType as EntityType,
        abn: values.abn.replace(/\D/g, ''),
        acn: '',
        industry: '',
        employees: 0,
        phone: profile.data?.phone ?? '',
        website: '',
        trusteeName: values.entityType === 'Trust' ? values.trusteeName : null,
      },
    })
  }

  const open = customer && !closed && entities.isSuccess && entities.data.length === 0 && profile.isSuccess
  if (!open) return null

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title="Welcome to your Business Portal"
      description="This is where you manage your ABN, business name registrations, renewals and cancellations."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Later
          </Button>
          <Button loading={create.isPending} onClick={form.handleSubmit(submit)}>
            Continue
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)} noValidate>
        <p className="font-medium text-ink">Let’s confirm your business details</p>
        <Field label="Entity type" required error={form.formState.errors.entityType?.message}>
          <Controller
            control={form.control}
            name="entityType"
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose one"
                items={TYPES}
              />
            )}
          />
        </Field>
        {entityType && entityType !== 'SoleTrader' ? (
          <Field label={NAME_LABELS[entityType] ?? 'Business name'} required error={form.formState.errors.name?.message}>
            <Field.Input {...form.register('name')} />
          </Field>
        ) : null}
        {entityType === 'Trust' ? (
          <Field label="Trustee name" required error={form.formState.errors.trusteeName?.message}>
            <Field.Input {...form.register('trusteeName')} placeholder="Full name of the trustee" />
          </Field>
        ) : null}
        <Field label="ABN" hint="11 digits" error={form.formState.errors.abn?.message}>
          <Field.Input inputMode="numeric" {...form.register('abn')} />
        </Field>
      </form>
    </Dialog>
  )
}
