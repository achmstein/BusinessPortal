import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, type UseFormReturn, type DefaultValues, type FieldValues } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAbnLookupSettingsOptions,
  getAbnLookupSettingsQueryKey,
  getCaptchaSettingsOptions,
  getCaptchaSettingsQueryKey,
  getEmailSettingsOptions,
  getEmailSettingsQueryKey,
  getRenewtronSettingsOptions,
  getRenewtronSettingsQueryKey,
  updateAbnLookupSettingsMutation,
  updateCaptchaSettingsMutation,
  updateEmailSettingsMutation,
  updateRenewtronSettingsMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import { runRenewtronSyncNow } from '@/api/generated'
import type { RenewtronSyncResult } from '@/api/generated'
import {
  Badge,
  Button,
  DatePicker,
  Field,
  FormActions,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  PasswordInput,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Integration credentials.
//
// Five independent forms that each save on their own, previously held together
// by nineteen useState calls and a local hook. Each is now its own small form
// with its own dirty state, so the Save button tells the truth about whether
// there is anything to save — the old one was always live and would happily
// report success for a form nobody had touched.
//
// Every section says what breaks while it is empty, because that is the actual
// question someone has when they arrive: what stops working if I leave this
// blank? The status word alone ("Not configured") doesn't answer it.
// ─────────────────────────────────────────────────────────────────────────────

function SecretInput({
  label,
  hint,
  placeholder,
  form,
  name,
}: {
  label: string
  hint?: ReactNode
  placeholder?: string
  form: UseFormReturn<FieldValues>
  name: string
}) {
  return (
    <Field label={label} hint={hint}>
      <PasswordInput
        mono
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        {...form.register(name)}
      />
    </Field>
  )
}

function SettingsGroup({
  title,
  purpose,
  whenEmpty,
  configured,
  form,
  onSave,
  saving,
  children,
  footer,
}: {
  title: string
  purpose: string
  whenEmpty: string
  configured: boolean
  form: UseFormReturn<FieldValues>
  onSave: () => void
  saving: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  const dirty = form.formState.isDirty
  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <PanelTitle>{title}</PanelTitle>
          <p className="max-w-prose text-sm text-ink-faint">{purpose}</p>
        </div>
        <Badge tone={configured ? 'ok' : 'due'} className="shrink-0">
          {configured ? 'Set' : 'Not set'}
        </Badge>
      </div>

      {!configured ? <p className="text-sm text-warn-700">{whenEmpty}</p> : null}

      <div className="flex flex-col gap-4">{children}</div>

      <FormActions dirty={dirty} saving={saving} onSave={onSave}>
        {footer}
      </FormActions>
    </Panel>
  )
}

const DESCRIPTION =
  'Credentials live on the server and take effect immediately — nothing here needs a restart or a redeploy.'

export function AdminSettingsPage() {
  const queryClient = useQueryClient()

  const captcha = useQuery(getCaptchaSettingsOptions())
  const email = useQuery(getEmailSettingsOptions())
  const abn = useQuery(getAbnLookupSettingsOptions())
  const renewtron = useQuery(getRenewtronSettingsOptions())

  const captchaForm = useForm<FieldValues>({ defaultValues: { apiKey: '' } })
  const emailForm = useForm<FieldValues>({
    defaultValues: { from: '', resendApiKey: '', sendGridApiKey: '', siteUrl: '' },
  })
  const abnForm = useForm<FieldValues>({ defaultValues: { apiToken: '' } })
  const renewtronForm = useForm<FieldValues>({ defaultValues: { baseUrl: '', apiKey: '', checkoutUrl: '', syncFrom: '' } })

  // Re-baseline each form once its values arrive, so isDirty means "you changed
  // something" rather than "the data loaded".
  useHydrate(captchaForm, captcha.data && { apiKey: captcha.data.apiKey ?? '' })
  useHydrate(
    emailForm,
    email.data && {
      from: email.data.from ?? '',
      resendApiKey: email.data.resendApiKey ?? '',
      sendGridApiKey: email.data.sendGridApiKey ?? '',
      siteUrl: email.data.siteUrl ?? '',
    },
  )
  useHydrate(abnForm, abn.data && { apiToken: abn.data.apiToken ?? '' })
  useHydrate(
    renewtronForm,
    renewtron.data && {
      baseUrl: renewtron.data.baseUrl ?? '',
      apiKey: renewtron.data.apiKey ?? '',
      checkoutUrl: renewtron.data.checkoutUrl ?? '',
      syncFrom: renewtron.data.syncFrom ?? '',
    },
  )

  const saved = (label: string, key: readonly unknown[], form: UseFormReturn<FieldValues>) => ({
    onSuccess: async (_data: unknown, variables: { body?: FieldValues }) => {
      await queryClient.invalidateQueries({ queryKey: key })
      if (variables.body) form.reset(variables.body)
      toastSuccess(`${label} saved`, 'Applies immediately — no restart needed.')
    },
    onError: () => toastError(`Couldn’t save ${label.toLowerCase()}`, 'Try again in a moment.'),
  })

  const saveCaptcha = useMutation({
    ...updateCaptchaSettingsMutation(),
    ...saved('2Captcha key', getCaptchaSettingsQueryKey(), captchaForm),
  })
  const saveEmail = useMutation({
    ...updateEmailSettingsMutation(),
    ...saved('Email settings', getEmailSettingsQueryKey(), emailForm),
  })
  const saveAbn = useMutation({
    ...updateAbnLookupSettingsMutation(),
    ...saved('ABN Lookup token', getAbnLookupSettingsQueryKey(), abnForm),
  })
  const saveRenewtron = useMutation({
    ...updateRenewtronSettingsMutation(),
    ...saved('Renewtron settings', getRenewtronSettingsQueryKey(), renewtronForm),
  })

  const [syncResult, setSyncResult] = useState<RenewtronSyncResult | null>(null)
  const sync = useMutation({
    mutationFn: async () => (await runRenewtronSyncNow({ throwOnError: true })).data,
    onSuccess: (result) => {
      setSyncResult(result ?? null)
      if (result?.configured) {
        toastSuccess(
          result.created === 1 ? '1 login created' : `${result.created} logins created`,
          `${result.fetched} completed renewals checked.`,
        )
      }
    },
    onError: () => toastError('The sync didn’t finish', 'Check the API key and try again.'),
  })

  const loading =
    captcha.isPending || email.isPending || abn.isPending || renewtron.isPending

  if (loading) {
    return (
      <Page title="Integrations" description={DESCRIPTION}>
        <PageSkeleton blocks={3} />
      </Page>
    )
  }

  return (
    <Page title="Integrations" description={DESCRIPTION}>

      <SettingsGroup
        title="Renewtron"
        purpose="Renewtron takes renewal payments, renews names at ASIC, syncs Ontraport and retrieves ASIC keys. Every 10 minutes the portal mirrors its renewals (creating a login for each paying customer) and brings back ASIC keys; the Renew button sends customers to its checkout."
        whenEmpty="Without the partner key there's no renewal sync, no ASIC key requests, and customers who renew won't get a portal account."
        configured={Boolean(renewtron.data?.apiKey)}
        form={renewtronForm}
        saving={saveRenewtron.isPending}
        onSave={renewtronForm.handleSubmit((values) =>
          saveRenewtron.mutate({
            body: {
              baseUrl: values.baseUrl || null,
              apiKey: values.apiKey || null,
              checkoutUrl: values.checkoutUrl || null,
              syncFrom: values.syncFrom || null,
            },
          }),
        )}
        footer={
          <>
            <Button variant="secondary" loading={sync.isPending} onClick={() => sync.mutate()}>
              Sync now
            </Button>
            {syncResult ? (
              <span className="text-sm text-ink-faint">
                {syncResult.configured
                  ? `${syncResult.fetched} renewals checked · ${syncResult.created} logins created · ${syncResult.keysApplied ?? 0} ASIC keys applied${Number(syncResult.failed) > 0 ? ` · ${syncResult.failed} failed` : ''}`
                  : (syncResult.message ?? 'Not configured.')}
              </span>
            ) : null}
          </>
        }
      >
        <Field
          label="API address"
          hint="Where the portal calls Renewtron. On the same server, use its internal address so these calls never leave the machine."
        >
          <Field.Input placeholder="https://businessnames.applyforanabn.au" {...renewtronForm.register('baseUrl')} />
        </Field>
        <SecretInput
          label="Partner API key"
          hint="Renewtron's scoped partner key (Security__PartnerApiKey) — not its admin key."
          form={renewtronForm}
          name="apiKey"
        />
        <Field label="Checkout address" hint="Where customers go to renew. Leave blank if it's the same as the API address.">
          <Field.Input placeholder="https://businessnames.applyforanabn.au" {...renewtronForm.register('checkoutUrl')} />
        </Field>
        <Field
          label="Only customers from"
          hint="Renewals and Ontraport sales from this date on get a portal account and welcome email; earlier customers are left alone. Blank = everyone from the last 90 days."
        >
          <Controller
            control={renewtronForm.control}
            name="syncFrom"
            render={({ field }) => <DatePicker value={field.value ?? ''} onChange={field.onChange} />}
          />
        </Field>
      </SettingsGroup>

      <SettingsGroup
        title="Email"
        purpose="Sends password resets, portal invites and notifications."
        whenEmpty="Without a key, emails are written to the server log instead of sent — invited customers never receive their link."
        configured={Boolean(email.data?.resendApiKey || email.data?.sendGridApiKey)}
        form={emailForm}
        saving={saveEmail.isPending}
        onSave={emailForm.handleSubmit((values) =>
          saveEmail.mutate({
            body: {
              from: values.from || null,
              resendApiKey: values.resendApiKey || null,
              sendGridApiKey: values.sendGridApiKey || null,
              siteUrl: values.siteUrl || null,
            },
          }),
        )}
      >
        <SecretInput label="Resend API key" placeholder="re_…" form={emailForm} name="resendApiKey" />
        <SecretInput
          label="SendGrid API key"
          hint="An alternative to Resend — Resend wins if both are set."
          placeholder="SG.…"
          form={emailForm}
          name="sendGridApiKey"
        />
        <Field label="From address">
          <Field.Input placeholder="Business Portal <no-reply@example.com>" {...emailForm.register('from')} />
        </Field>
        <Field label="Site URL" hint="Used to build emailed links, so it must be the address customers can reach.">
          <Field.Input placeholder="https://myportal.idealbusiness.au" {...emailForm.register('siteUrl')} />
        </Field>
      </SettingsGroup>

      <SettingsGroup
        title="ABN Lookup"
        purpose="Looks up businesses by ABN against the Australian Business Register."
        whenEmpty="Without a token, the “Check ABN Lookup” button on a client's business names does nothing."
        configured={Boolean(abn.data?.apiToken)}
        form={abnForm}
        saving={saveAbn.isPending}
        onSave={abnForm.handleSubmit((values) => saveAbn.mutate({ body: { apiToken: values.apiToken || null } }))}
      >
        <SecretInput
          label="API token"
          hint="A GUID from abr.business.gov.au."
          placeholder="00000000-0000-0000-0000-000000000000"
          form={abnForm}
          name="apiToken"
        />
      </SettingsGroup>

      <SettingsGroup
        title="2Captcha"
        purpose="Solves the reCAPTCHA on ASIC Connect when enriching renewal dates."
        whenEmpty="Without a key, ASIC lookups are skipped and renewal dates must be entered by hand."
        configured={Boolean(captcha.data?.apiKey)}
        form={captchaForm}
        saving={saveCaptcha.isPending}
        onSave={captchaForm.handleSubmit((values) =>
          saveCaptcha.mutate({ body: { apiKey: values.apiKey || null } }),
        )}
      >
        <SecretInput label="API key" hint="Each solve spends 2Captcha credit." form={captchaForm} name="apiKey" />
      </SettingsGroup>
    </Page>
  )
}

/** Reset a form to server values once, so isDirty tracks edits, not loading. */
function useHydrate(form: UseFormReturn<FieldValues>, values: FieldValues | undefined | null | false) {
  const { reset } = form
  useEffect(() => {
    if (values) reset(values as DefaultValues<FieldValues>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values ?? null), reset])
}
