import { useEffect, useState, type ReactNode } from 'react'
import { useForm, type UseFormReturn, type DefaultValues, type FieldValues } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAbnLookupSettingsOptions,
  getAbnLookupSettingsQueryKey,
  getCaptchaSettingsOptions,
  getCaptchaSettingsQueryKey,
  getEmailSettingsOptions,
  getEmailSettingsQueryKey,
  getOntraportSettingsOptions,
  getOntraportSettingsQueryKey,
  getRenewtronSettingsOptions,
  getRenewtronSettingsQueryKey,
  updateAbnLookupSettingsMutation,
  updateCaptchaSettingsMutation,
  updateEmailSettingsMutation,
  updateOntraportSettingsMutation,
  updateRenewtronSettingsMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import { runRenewtronSyncNow } from '@/api/generated'
import type { RenewtronSyncResult } from '@/api/generated'
import {
  Badge,
  Button,
  CopyButton,
  Field,
  PageHeader,
  Panel,
  PasswordInput,
  Skeleton,
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

/** The URL to paste into Ontraport — awkward to select by hand out of prose. */
function WebhookUrl({ origin, path }: { origin: string; path: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs break-all">POST {origin}{path}</code>
      <CopyButton value={`${origin}${path}`} label={`Copy the ${path} URL`} />
    </span>
  )
}

function Section({
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
          <h2 className="font-display text-xl leading-tight font-semibold text-ink">{title}</h2>
          <p className="max-w-prose text-sm text-ink-faint">{purpose}</p>
        </div>
        <Badge tone={configured ? 'ok' : 'due'} className="shrink-0">
          {configured ? 'Set' : 'Not set'}
        </Badge>
      </div>

      {!configured ? <p className="text-sm text-warn-700">{whenEmpty}</p> : null}

      <div className="flex flex-col gap-4">{children}</div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-4">
        {footer}
        {dirty ? <span className="text-sm text-ink-faint">Unsaved changes</span> : null}
        <Button onClick={onSave} disabled={!dirty} loading={saving}>
          Save
        </Button>
      </div>
    </Panel>
  )
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient()

  const captcha = useQuery(getCaptchaSettingsOptions())
  const ontraport = useQuery(getOntraportSettingsOptions())
  const email = useQuery(getEmailSettingsOptions())
  const abn = useQuery(getAbnLookupSettingsOptions())
  const renewtron = useQuery(getRenewtronSettingsOptions())

  const captchaForm = useForm<FieldValues>({ defaultValues: { apiKey: '' } })
  const ontraportForm = useForm<FieldValues>({ defaultValues: { webhookSecret: '', renewalSecret: '' } })
  const emailForm = useForm<FieldValues>({
    defaultValues: { from: '', resendApiKey: '', sendGridApiKey: '', siteUrl: '' },
  })
  const abnForm = useForm<FieldValues>({ defaultValues: { apiToken: '' } })
  const renewtronForm = useForm<FieldValues>({ defaultValues: { baseUrl: '', apiKey: '' } })

  // Re-baseline each form once its values arrive, so isDirty means "you changed
  // something" rather than "the data loaded".
  useHydrate(captchaForm, captcha.data && { apiKey: captcha.data.apiKey ?? '' })
  useHydrate(
    ontraportForm,
    ontraport.data && {
      webhookSecret: ontraport.data.webhookSecret ?? '',
      renewalSecret: ontraport.data.renewalSecret ?? '',
    },
  )
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
    renewtron.data && { baseUrl: renewtron.data.baseUrl ?? '', apiKey: renewtron.data.apiKey ?? '' },
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
  const saveOntraport = useMutation({
    ...updateOntraportSettingsMutation(),
    ...saved('Ontraport secrets', getOntraportSettingsQueryKey(), ontraportForm),
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
    captcha.isPending || ontraport.isPending || email.isPending || abn.isPending || renewtron.isPending

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const origin = window.location.origin

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader
        title="Integrations"
        description="Credentials live on the server and take effect immediately — nothing here needs a restart or a redeploy."
      />

      <Section
        title="Renewtron"
        purpose="Checks Renewtron every 10 minutes for completed business name renewals and creates a portal login for each customer, emailing new ones a link to set a password."
        whenEmpty="Without an API key the sync is off, and customers who renew won't get a portal account."
        configured={Boolean(renewtron.data?.apiKey)}
        form={renewtronForm}
        saving={saveRenewtron.isPending}
        onSave={renewtronForm.handleSubmit((values) =>
          saveRenewtron.mutate({ body: { baseUrl: values.baseUrl || null, apiKey: values.apiKey || null } }),
        )}
        footer={
          <div className="mr-auto flex flex-wrap items-center gap-3">
            <Button variant="secondary" loading={sync.isPending} onClick={() => sync.mutate()}>
              Sync now
            </Button>
            {syncResult ? (
              <span className="text-sm text-ink-faint">
                {syncResult.configured
                  ? `${syncResult.fetched} checked · ${syncResult.created} created · ${syncResult.updated} updated · ${syncResult.skipped} skipped${Number(syncResult.failed) > 0 ? ` · ${syncResult.failed} failed` : ''}`
                  : (syncResult.message ?? 'Not configured.')}
              </span>
            ) : null}
          </div>
        }
      >
        <Field label="Base URL">
          <Field.Input placeholder="https://businessnames.applyforanabn.au" {...renewtronForm.register('baseUrl')} />
        </Field>
        <SecretInput
          label="API key"
          hint="The same X-Api-Key value Renewtron accepts from Mastertron."
          form={renewtronForm}
          name="apiKey"
        />
      </Section>

      <Section
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
      </Section>

      <Section
        title="Ontraport webhooks"
        purpose="Shared secrets the Ontraport rules must send in the X-Ontraport-Secret header."
        whenEmpty="An empty secret rejects every request to that webhook."
        configured={Boolean(ontraport.data?.webhookSecret || ontraport.data?.renewalSecret)}
        form={ontraportForm}
        saving={saveOntraport.isPending}
        onSave={ontraportForm.handleSubmit((values) =>
          saveOntraport.mutate({
            body: {
              webhookSecret: values.webhookSecret || null,
              renewalSecret: values.renewalSecret || null,
            },
          }),
        )}
      >
        <SecretInput
          label="Contact sync secret"
          hint={<WebhookUrl path="/api/integrations/ontraport/webhook" origin={origin} />}
          form={ontraportForm}
          name="webhookSecret"
        />
        <SecretInput
          label="Renewal paid secret"
          hint={<WebhookUrl path="/api/integrations/ontraport/renewal-paid" origin={origin} />}
          form={ontraportForm}
          name="renewalSecret"
        />
      </Section>

      <Section
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
      </Section>

      <Section
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
      </Section>
    </div>
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
