import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Icon } from '../../components/Icon'
import {
  getCaptchaSettings,
  updateCaptchaSettings,
  getOntraportSettings,
  updateOntraportSettings,
  getEmailSettings,
  updateEmailSettings,
  getAbnLookupSettings,
  updateAbnLookupSettings,
  getRenewtronSettings,
  updateRenewtronSettings,
  runRenewtronSyncNow,
  type RenewtronSyncResult,
} from '../../api/generated'

// Modelled on Asictron's SettingsPage: integration credentials are stored on the
// server (settings.overrides.json on the data volume) and take effect immediately.

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${configured ? 'text-accent-700' : 'text-navy-400'}`}
      title={configured ? 'Credentials are set' : 'Credentials are missing'}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${configured ? 'bg-accent-500' : 'bg-navy-300'}`} />
      {configured ? 'Configured' : 'Not configured'}
    </span>
  )
}

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-10 font-mono"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide value' : 'Show value'}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-navy-400 hover:text-navy-700"
      >
        <Icon name={show ? 'eye-off' : 'eye'} />
      </button>
    </div>
  )
}

function SettingsSection({
  title,
  subtitle,
  configured,
  busy,
  saved,
  error,
  onSubmit,
  children,
}: {
  title: string
  subtitle: string
  configured?: boolean
  busy: boolean
  saved: boolean
  error: string | null
  onSubmit: (e: FormEvent) => void
  children: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} className="card-pad">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
        {configured !== undefined ? <StatusPill configured={configured} /> : null}
      </div>
      <p className="mt-0.5 text-sm text-navy-500">{subtitle}</p>

      <div className="mt-4 space-y-4">{children}</div>

      {error ? (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">{error}</div>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-accent-700">Saved — applies immediately.</span> : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

// Per-section save state, shared by the four forms below.
function useSave(save: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      await save()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return { busy, saved, error, onSubmit }
}

export function AdminSettingsPage() {
  const [loadError, setLoadError] = useState<string | null>(null)

  // 2Captcha
  const [captchaKey, setCaptchaKey] = useState('')
  // Ontraport webhooks
  const [webhookSecret, setWebhookSecret] = useState('')
  const [renewalSecret, setRenewalSecret] = useState('')
  // Email (Resend)
  const [emailFrom, setEmailFrom] = useState('')
  const [resendApiKey, setResendApiKey] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  // ABN Lookup
  const [abnToken, setAbnToken] = useState('')
  // Renewtron renewal sync
  const [renewtronBaseUrl, setRenewtronBaseUrl] = useState('')
  const [renewtronApiKey, setRenewtronApiKey] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncResult, setSyncResult] = useState<RenewtronSyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [captcha, ontraport, email, abn, renewtron] = await Promise.all([
          getCaptchaSettings(),
          getOntraportSettings(),
          getEmailSettings(),
          getAbnLookupSettings(),
          getRenewtronSettings(),
        ])
        setCaptchaKey(captcha.data?.apiKey ?? '')
        setWebhookSecret(ontraport.data?.webhookSecret ?? '')
        setRenewalSecret(ontraport.data?.renewalSecret ?? '')
        setEmailFrom(email.data?.from ?? '')
        setResendApiKey(email.data?.resendApiKey ?? '')
        setSiteUrl(email.data?.siteUrl ?? '')
        setAbnToken(abn.data?.apiToken ?? '')
        setRenewtronBaseUrl(renewtron.data?.baseUrl ?? '')
        setRenewtronApiKey(renewtron.data?.apiKey ?? '')
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load settings')
      }
    })()
  }, [])

  const runSyncNow = async () => {
    setSyncBusy(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await runRenewtronSyncNow({ throwOnError: true })
      setSyncResult(res.data)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncBusy(false)
    }
  }

  const captcha = useSave(() =>
    updateCaptchaSettings({ body: { apiKey: captchaKey.trim() || null } }))
  const ontraport = useSave(() =>
    updateOntraportSettings({
      body: {
        webhookSecret: webhookSecret.trim() || null,
        renewalSecret: renewalSecret.trim() || null,
      },
    }))
  const email = useSave(() =>
    updateEmailSettings({
      body: {
        from: emailFrom.trim() || null,
        resendApiKey: resendApiKey.trim() || null,
        siteUrl: siteUrl.trim() || null,
      },
    }))
  const abn = useSave(() =>
    updateAbnLookupSettings({ body: { apiToken: abnToken.trim() || null } }))
  const renewtron = useSave(() =>
    updateRenewtronSettings({
      body: {
        baseUrl: renewtronBaseUrl.trim() || null,
        apiKey: renewtronApiKey.trim() || null,
      },
    }))

  const origin = window.location.origin

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Integration credentials are stored on the server and take effect immediately — no restart or redeploy required."
      />

      {loadError ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">{loadError}</div>
      ) : null}

      <div className="max-w-2xl space-y-6">
        <SettingsSection
          title="2Captcha"
          subtitle="Solves the invisible reCAPTCHA on ASIC Connect lookups (renewal-date enrichment). Each solve uses a small amount of 2Captcha credit."
          configured={captchaKey.trim().length > 0}
          {...captcha}
        >
          <div>
            <label className="label" htmlFor="captchaKey">API key</label>
            <SecretInput id="captchaKey" value={captchaKey} onChange={setCaptchaKey} placeholder="From your 2Captcha dashboard" />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Ontraport webhooks"
          subtitle="Shared secrets the Ontraport rules must send in the X-Ontraport-Secret header. An empty secret disables that webhook."
          configured={webhookSecret.trim().length > 0 || renewalSecret.trim().length > 0}
          {...ontraport}
        >
          <div>
            <label className="label" htmlFor="webhookSecret">Contact-sync secret</label>
            <SecretInput id="webhookSecret" value={webhookSecret} onChange={setWebhookSecret} />
            <p className="mt-1 text-xs text-navy-500 font-mono break-all">POST {origin}/api/integrations/ontraport/webhook</p>
          </div>
          <div>
            <label className="label" htmlFor="renewalSecret">Renewal-paid secret</label>
            <SecretInput id="renewalSecret" value={renewalSecret} onChange={setRenewalSecret} />
            <p className="mt-1 text-xs text-navy-500 font-mono break-all">POST {origin}/api/integrations/ontraport/renewal-paid</p>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Email"
          subtitle="Outbound email via Resend — password resets and notifications. Without an API key, emails are logged to the server console instead of sent."
          configured={resendApiKey.trim().length > 0}
          {...email}
        >
          <div>
            <label className="label" htmlFor="resendApiKey">Resend API key</label>
            <SecretInput id="resendApiKey" value={resendApiKey} onChange={setResendApiKey} placeholder="re_..." />
          </div>
          <div>
            <label className="label" htmlFor="emailFrom">From address</label>
            <input
              id="emailFrom"
              className="input"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="Business Portal <no-reply@example.com>"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="siteUrl">Site URL</label>
            <input
              id="siteUrl"
              className="input"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://myportal.example.com"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-navy-500">Base URL used in emailed links (e.g. password reset).</p>
          </div>
        </SettingsSection>

        <SettingsSection
          title="ABN Lookup"
          subtitle="ABR web services token used to look up businesses by ABN. Register at abr.business.gov.au to get a GUID."
          configured={abnToken.trim().length > 0}
          {...abn}
        >
          <div>
            <label className="label" htmlFor="abnToken">API token (GUID)</label>
            <SecretInput id="abnToken" value={abnToken} onChange={setAbnToken} placeholder="00000000-0000-0000-0000-000000000000" />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Renewtron renewal sync"
          subtitle="Polls Renewtron every 10 minutes for completed business name renewals and creates a portal login for each customer (new accounts get a set-password invite email). An empty API key turns the sync off."
          configured={renewtronApiKey.trim().length > 0}
          {...renewtron}
        >
          <div>
            <label className="label" htmlFor="renewtronBaseUrl">Base URL</label>
            <input
              id="renewtronBaseUrl"
              className="input"
              value={renewtronBaseUrl}
              onChange={(e) => setRenewtronBaseUrl(e.target.value)}
              placeholder="https://businessnames.applyforanabn.au"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="renewtronApiKey">API key</label>
            <SecretInput id="renewtronApiKey" value={renewtronApiKey} onChange={setRenewtronApiKey} placeholder="Renewtron's X-Api-Key value" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={syncBusy}
              onClick={() => void runSyncNow()}
            >
              {syncBusy ? 'Syncing…' : 'Sync now'}
            </button>
            {syncResult ? (
              <span className="text-sm text-navy-600">
                {syncResult.configured
                  ? `${syncResult.fetched} completed renewals — ${syncResult.created} logins created, ${syncResult.updated} updated, ${syncResult.skipped} skipped, ${syncResult.failed} failed.`
                  : (syncResult.message ?? 'Not configured.')}
              </span>
            ) : null}
          </div>
          {syncError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">{syncError}</div>
          ) : null}
        </SettingsSection>
      </div>
    </>
  )
}
