import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  getMeOptions,
  getProfileOptions,
  getProfileQueryKey,
  updateProfileMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import {
  Button,
  DatePicker,
  ErrorState,
  Field,
  FormActions,
  toastError,
  toastSuccess,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  PasswordInput,
  Select,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Contact and tax details.
//
// Grouped by why we hold each thing rather than by field type, because the
// question people actually have on this page is "why does a business-name
// portal want my tax file number?". Each section answers that above its fields.
//
// The TFN is masked until deliberately revealed. It was previously a plain text
// input rendering in full on load, which is a poor default on a screen someone
// might be sharing, and it is the single most sensitive value here.
//
// The save button only wakes up when something has actually changed, so the
// page can't tell you it "saved" work you didn't do.
//
// No ABN here: it belongs to a business, and is entered under Business. Asking
// for it on both pages read as a double-up.
// ─────────────────────────────────────────────────────────────────────────────

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  phone: z.string(),
  dob: z.string(),
  tfn: z
    .string()
    .refine((v) => v.replace(/\D/g, '').length === 0 || v.replace(/\D/g, '').length === 9, {
      message: 'A tax file number has 9 digits.',
    }),
  address: z.string(),
  suburb: z.string(),
  state: z.string(),
  postcode: z
    .string()
    .refine((v) => v.trim().length === 0 || /^\d{4}$/.test(v.trim()), {
      message: 'An Australian postcode has 4 digits.',
    }),
})

type ProfileForm = z.infer<typeof schema>

const EMPTY: ProfileForm = {
  firstName: '',
  lastName: '',
  phone: '',
  dob: '',
  tfn: '',
  address: '',
  suburb: '',
  state: '',
  postcode: '',
}

export function ProfilePage() {
  const queryClient = useQueryClient()
  const profile = useQuery(getProfileOptions())
  const me = useQuery(getMeOptions())

  const form = useForm<ProfileForm>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const { reset } = form

  useEffect(() => {
    if (!profile.data) return
    reset({
      firstName: profile.data.firstName ?? '',
      lastName: profile.data.lastName ?? '',
      phone: profile.data.phone ?? '',
      dob: profile.data.dob ?? '',
      tfn: profile.data.tfn ?? '',
      address: profile.data.address ?? '',
      suburb: profile.data.suburb ?? '',
      state: profile.data.state ?? '',
      postcode: profile.data.postcode ?? '',
    })
  }, [profile.data, reset])

  const save = useMutation({
    ...updateProfileMutation(),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: getProfileQueryKey() })
      // Re-baseline so the form is clean again and the button settles.
      const { abn: _abn, ...values } = variables.body
      reset(values as ProfileForm)
      toastSuccess('Details saved')
    },
    onError: () => toastError('We couldn’t save your details', 'Try again in a moment.'),
  })

  const header = { title: 'Your details', description: 'How we reach you, and what we need for the ATO.' }

  if (profile.isPending) {
    return (
      <Page {...header}>
        <PageSkeleton blocks={3} />
      </Page>
    )
  }

  if (profile.isError) {
    return (
      <Page {...header}>
        <ErrorState
          description="We couldn’t load your details just now."
          action={
            <Button variant="secondary" onClick={() => void profile.refetch()}>
              Try again
            </Button>
          }
        />
      </Page>
    )
  }

  return (
    <Page {...header}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit((values) => save.mutate({ body: { ...values, abn: null } }))}
        noValidate
      >

        <Panel className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <PanelTitle as="h2">
              How we reach you
            </PanelTitle>
            <p className="text-sm text-ink-faint">
              We use these to contact you before a renewal falls due.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" required error={form.formState.errors.firstName?.message}>
              <Field.Input autoComplete="given-name" {...form.register('firstName')} />
            </Field>
            <Field label="Last name" required error={form.formState.errors.lastName?.message}>
              <Field.Input autoComplete="family-name" {...form.register('lastName')} />
            </Field>
            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Field.Input type="tel" autoComplete="tel" {...form.register('phone')} />
            </Field>
            <Field label="Email" hint="Message us if you need this changed — it’s your sign-in.">
              <Field.Input value={me.data?.email ?? ''} disabled readOnly />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <PanelTitle as="h2">
              For the ATO
            </PanelTitle>
            <p className="text-sm text-ink-faint">
              Only needed if we lodge or deal with the ATO on your behalf. You can leave these blank.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date of birth" error={form.formState.errors.dob?.message}>
              {/* The picker's input is still typeable, which matters here: nobody
                  pages a calendar back forty years to find their own birthday. */}
              <Controller
                control={form.control}
                name="dob"
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
              label="Tax file number"
              hint="Kept encrypted. We never show it in full unless you ask."
              error={form.formState.errors.tfn?.message}
            >
              <PasswordInput
                inputMode="numeric"
                autoComplete="off"
                invalid={Boolean(form.formState.errors.tfn)}
                {...form.register('tfn')}
              />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <PanelTitle as="h2">
              Postal address
            </PanelTitle>
            <p className="text-sm text-ink-faint">Where ASIC and the ATO send anything by post.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Street address" className="sm:col-span-2" error={form.formState.errors.address?.message}>
              <Field.Input autoComplete="street-address" {...form.register('address')} />
            </Field>
            <Field label="Suburb" error={form.formState.errors.suburb?.message}>
              <Field.Input autoComplete="address-level2" {...form.register('suburb')} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State" error={form.formState.errors.state?.message}>
                <Controller
                  control={form.control}
                  name="state"
                  render={({ field, fieldState }) => (
                    <Select
                      name="state"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      invalid={Boolean(fieldState.error)}
                      placeholder="—"
                      items={STATES.map((state) => ({ value: state, label: state }))}
                    />
                  )}
                />
              </Field>
              <Field label="Postcode" error={form.formState.errors.postcode?.message}>
                <Field.Input inputMode="numeric" maxLength={4} autoComplete="postal-code" {...form.register('postcode')} />
              </Field>
            </div>
          </div>
        </Panel>

        <FormActions dirty={form.formState.isDirty} saving={save.isPending} />
      </form>
    </Page>
  )
}
