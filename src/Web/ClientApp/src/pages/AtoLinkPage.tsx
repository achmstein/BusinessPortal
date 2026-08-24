import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Smartphone } from 'lucide-react'
import {
  pollAtoLink,
  selectAtoAgent,
  startAtoLink,
  type AtoAgentDto,
  type AtoPollResult,
} from '@/api/generated'
import { Button, Checkbox, ErrorState, Field, PageHeader, Panel, PanelTitle, toastError } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Linking to the ATO via myID.
//
// The unusual thing about this page is that during its critical step the
// person's attention is on their phone, not on this screen: they read a code
// here, open myID, type it, and approve — against a five-minute deadline. The
// design follows from that.
//
//  · The reference code is the only thing on the screen that matters at that
//    moment, so it is sized to be read at arm's length and steps down on narrow
//    phones (it was a fixed text-5xl that overflowed). It is not chunked into
//    groups: inventing spaces in a code someone must type exactly invites them
//    to type the spaces too.
//  · The five-minute window was stated in prose but never shown. It is now a
//    live countdown, because "do I have time to find my phone or should I start
//    again?" is the actual question at that moment.
//  · Status changes are announced in a live region. Previously a screen-reader
//    user got no notification that the link had succeeded.
//  · The old copy promised the page "auto-refreshes every few seconds". It does
//    not refresh; it holds a long poll open. The copy now says what happens.
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'start' | 'approve' | 'chooseAgent' | 'failed'

/** Each poll is a ~20s server-side long poll; the attempt expires server-side too. */
const MAX_POLLS = 18
const APPROVAL_WINDOW_SECONDS = 300

const startSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter the email address you use for myID.')
    .email('That doesn’t look like an email address.'),
})

type StartForm = z.infer<typeof startSchema>

function Countdown({ secondsLeft }: { secondsLeft: number }) {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const urgent = secondsLeft <= 60

  return (
    <p className={urgent ? 'text-sm text-rust-600' : 'text-sm text-sage'}>
      {secondsLeft > 0 ? (
        <>
          Approve within{' '}
          <span data-numeric className="font-medium">
            {minutes}:{String(seconds).padStart(2, '0')}
          </span>
        </>
      ) : (
        'The approval window has closed — start again to get a new code.'
      )}
    </p>
  )
}

export function AtoLinkPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('start')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [agents, setAgents] = useState<AtoAgentDto[]>([])
  const [selectedAbn, setSelectedAbn] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(APPROVAL_WINDOW_SECONDS)
  const pollingRef = useRef(false)

  const form = useForm<StartForm>({ resolver: zodResolver(startSchema), defaultValues: { email: '' } })

  const applyPollResult = useCallback((data: AtoPollResult): boolean => {
    if (data.status === 'Linked') {
      pollingRef.current = false
      const list = data.agents ?? []
      setAgents(list)
      setSelectedAbn(list[0]?.abn ?? '')
      setStep('chooseAgent')
      return true
    }
    if (data.status === 'Failed' || data.status === 'Expired') {
      pollingRef.current = false
      setFailure(data.reason ?? null)
      setStep('failed')
      return true
    }
    return false // Pending — keep waiting.
  }, [])

  async function onStart(values: StartForm) {
    if (!consent) {
      setConsentError('Tick this to confirm you authorise the link.')
      return
    }
    setConsentError(undefined)
    setBusy(true)
    try {
      const { data } = await startAtoLink({ body: { email: values.email.toLowerCase() } })
      setAttemptId(data!.attemptId)
      setCode(data!.referenceCode)
      setSecondsLeft(APPROVAL_WINDOW_SECONDS)
      setStep('approve')
    } catch (error) {
      const message = (error as { error?: string })?.error
      form.setError('email', { message: message || 'We couldn’t start the link. Try again shortly.' })
    } finally {
      setBusy(false)
    }
  }

  // Long-poll while waiting for approval.
  useEffect(() => {
    if (step !== 'approve' || !attemptId) return
    pollingRef.current = true
    void (async () => {
      for (let i = 0; i < MAX_POLLS && pollingRef.current; i++) {
        try {
          const { data } = await pollAtoLink({ body: { attemptId } })
          if (!pollingRef.current) return
          if (applyPollResult(data!)) return
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
      if (pollingRef.current) {
        setFailure('We didn’t hear back from the myID app in time.')
        setStep('failed')
      }
    })()
    return () => {
      pollingRef.current = false
    }
  }, [step, attemptId, applyPollResult])

  // The countdown answers "should I hurry or start again?".
  useEffect(() => {
    if (step !== 'approve') return
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [step])

  async function onSaveAgent() {
    setBusy(true)
    try {
      await selectAtoAgent({ body: { abn: selectedAbn } })
      navigate('/ato-portal')
    } catch {
      toastError('We linked your account but couldn’t save that agent', 'Try selecting it again from the ATO page.')
      navigate('/ato-portal')
    } finally {
      setBusy(false)
    }
  }

  function restart() {
    pollingRef.current = false
    setStep('start')
    setAttemptId(null)
    setCode(null)
    setAgents([])
    setSelectedAbn('')
    setFailure(null)
    setSecondsLeft(APPROVAL_WINDOW_SECONDS)
  }

  const stepLabel = step === 'start' ? 'Step 1 of 2' : step === 'approve' ? 'Step 2 of 2' : undefined

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/ato-portal"
        className="inline-flex items-center gap-1.5 self-start text-sm text-bottle-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to ATO
      </Link>

      <PageHeader
        title="Link your business to the ATO"
        eyebrow={stepLabel}
        description="You approve the link in the myID app on your phone. We never see your password or two-factor codes."
      />

      {/* Announces success and failure to screen readers, which previously got
          no notification at all when the state changed. */}
      <p aria-live="polite" className="sr-only">
        {step === 'approve' ? 'Waiting for you to approve the link in the myID app.' : null}
        {step === 'chooseAgent' ? 'Linked to the ATO. Choose an agent profile to finish.' : null}
        {step === 'failed' ? 'The link did not complete.' : null}
      </p>

      {step === 'start' ? (
        <Panel className="flex max-w-2xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <PanelTitle as="h2">Before you start</PanelTitle>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-sage">
              <li>
                You have the <strong className="font-medium text-ink">myID</strong> app installed on your
                phone.
              </li>
              <li>You’re the principal authority for the business — a director, owner or public officer.</li>
              <li>Your phone is within reach; the next step is timed.</li>
            </ul>
          </div>

          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onStart)} noValidate>
            <Field
              label="Your myID email"
              required
              hint="The address you sign in to myID with."
              error={form.formState.errors.email?.message}
            >
              <Field.Input type="email" autoComplete="email" {...form.register('email')} />
            </Field>

            <Checkbox
              checked={consent}
              onCheckedChange={(next) => {
                setConsent(next)
                if (next) setConsentError(undefined)
              }}
              error={consentError}
            >
              I authorise the Business Portal to link my ATO account on my behalf. My consent will be
              recorded.
            </Checkbox>

            <Button type="submit" size="lg" loading={busy} className="self-start">
              Start the link
            </Button>
          </form>
        </Panel>
      ) : null}

      {step === 'approve' ? (
        <Panel className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <PanelTitle as="h2">Approve it on your phone</PanelTitle>
            <p className="text-sm text-sage">
              Open <strong className="font-medium text-ink">myID</strong>, enter this code if you’re asked
              for one, then tap Approve.
            </p>
          </div>

          {code ? (
            <div className="flex flex-col items-center gap-2 rounded-sm bg-surface-sunken px-4 py-7 text-center">
              <span className="text-xs tracking-[0.12em] text-sage uppercase">Reference code</span>
              <span
                data-numeric
                // Sized to read at arm's length while holding a phone, and it
                // steps down rather than overflowing a narrow screen.
                className="font-display text-[clamp(2.25rem,12vw,3.75rem)] leading-none font-medium tracking-[0.15em] text-ink"
                // Spelled out so a screen reader reads characters, not a word.
                aria-label={code.split('').join(' ')}
              >
                {code}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <Countdown secondsLeft={secondsLeft} />
            <p className="text-sm text-sage">
              Keep this page open — it updates by itself the moment you approve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={restart}>
              Start again
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 'chooseAgent' ? (
        <Panel className="flex max-w-2xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <PanelTitle as="h2">You’re linked to the ATO</PanelTitle>
            <p className="text-sm text-sage">
              {agents.length > 0
                ? 'One last thing — which agent profile should we act under?'
                : 'No agent profiles were found on your myID record. You can continue without one.'}
            </p>
          </div>

          {agents.length > 1 ? (
            <Field label="Agent profile">
              <Field.Select value={selectedAbn} onChange={(e) => setSelectedAbn(e.currentTarget.value)}>
                {agents.map((agent) => (
                  <option key={agent.abn} value={agent.abn}>
                    {agent.name} — ABN {agent.abn} · RAN {agent.ran}
                  </option>
                ))}
              </Field.Select>
            </Field>
          ) : agents.length === 1 ? (
            <p className="text-sm text-sage">
              Using <strong className="font-medium text-ink">{agents[0].name}</strong> (RAN {agents[0].ran}).
            </p>
          ) : null}

          <Button size="lg" loading={busy} onClick={() => void onSaveAgent()} className="self-start">
            Finish
          </Button>
        </Panel>
      ) : null}

      {step === 'failed' ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <ErrorState
            title="The link didn’t complete"
            description={
              failure ??
              'The approval wasn’t confirmed. This usually means the window closed before the myID app was opened.'
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={restart}>
              <Smartphone aria-hidden className="size-4" />
              Try again
            </Button>
            <Button asChild variant="secondary">
              <Link to="/messages">Ask us for help</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
