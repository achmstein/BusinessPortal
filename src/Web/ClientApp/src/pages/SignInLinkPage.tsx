import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { redeemSignInLink } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Landing page for a one-click sign-in link (the portal's welcome email and
// Renewtron's renewal confirmation).
//
// It asks for a click rather than signing in on load. Email security scanners
// open every link in a message to check it; a page that redeemed the link on
// arrival would spend its single use before the customer ever saw it.
//
// The exception is Renewtron's checkout, which sends the customer here itself the
// moment they've paid (marked from=checkout). No scanner sees that link, so it
// signs straight in — and retries briefly while the account is still being made.
// ─────────────────────────────────────────────────────────────────────────────

type Reason = 'expired' | 'used' | 'invalid' | 'not-ready' | 'existing-account'

const PROBLEMS: Record<Reason, { title: string; description: string }> = {
  expired: {
    title: 'This link has expired',
    description: 'Sign-in links work for 72 hours. Sign in with your email instead — or reset your password if you haven’t set one.',
  },
  used: {
    title: 'This link has already been used',
    description: 'Each sign-in link works once. Sign in with your email — or reset your password if you haven’t set one.',
  },
  invalid: {
    title: 'This link doesn’t work',
    description: 'It may have been cut short by your email app. Sign in with your email instead.',
  },
  'existing-account': {
    title: 'You already have a portal account',
    description: 'Sign in with your email to see this renewal — or reset your password if you haven’t set one.',
  },
  'not-ready': {
    title: 'Your account is nearly ready',
    description: 'We’re still setting up your portal from your renewal. Try this link again in a few minutes.',
  },
}

export function SignInLinkPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh, user, loading } = useAuth()
  const token = params.get('t') ?? ''
  const fromCheckout = params.get('from') === 'checkout'
  const autoTries = useRef(0)

  const redeem = useMutation({
    // The client throws on non-2xx (lib/apiClient.ts), handing us the error body.
    mutationFn: async () => {
      try {
        await redeemSignInLink({ body: { token } })
      } catch (error) {
        const reason = (error as { reason?: string } | undefined)?.reason
        throw reason && reason in PROBLEMS ? (reason as Reason) : 'invalid'
      }
    },
    onSuccess: async () => {
      await refresh()
      navigate('/', { replace: true })
    },
  })

  useEffect(() => {
    if (!fromCheckout || !token || loading || redeem.isPending || redeem.isSuccess) return
    // Renewed from inside the portal: they're signed in already, and the link (made for
    // a brand-new account) has nothing to add — just take them back to their records.
    if (user) {
      navigate('/', { replace: true })
      return
    }
    const notReady = redeem.isError && redeem.error === ('not-ready' as unknown)
    if (redeem.isError && !notReady) return
    if (autoTries.current >= 4) return
    const timer = setTimeout(() => {
      autoTries.current += 1
      redeem.mutate()
    }, autoTries.current === 0 ? 0 : 3000)
    return () => clearTimeout(timer)
  }, [fromCheckout, token, loading, user, redeem.isPending, redeem.isSuccess, redeem.isError, redeem.error])

  const reason: Reason | null = !token ? 'invalid' : redeem.isError ? ((redeem.error as unknown as Reason) ?? 'invalid') : null
  const problem = reason ? PROBLEMS[reason] : null

  const autoRetrying = reason === 'not-ready' && autoTries.current < 4
  if (fromCheckout && token && (redeem.isIdle || redeem.isPending || redeem.isSuccess || autoRetrying)) {
    return (
      <AuthShell title="Opening your Business Portal…" description="Signing you in — this only takes a moment.">
        <Button size="lg" className="w-full" loading>
          Continue to your portal
        </Button>
      </AuthShell>
    )
  }

  if (problem) {
    return (
      <AuthShell
        title={problem.title}
        description={problem.description}
        footer={
          <Link to="/forgot-password" className="text-accent-600 hover:underline">
            Reset your password
          </Link>
        }
      >
        {reason === 'not-ready' ? (
          <Button size="lg" className="w-full" loading={redeem.isPending} onClick={() => redeem.mutate()}>
            Try again
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Sign in with your email</Link>
          </Button>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Open your Business Portal"
      description="Your business names, renewal dates and messages with our team, all in one place."
    >
      <Button size="lg" className="w-full" loading={redeem.isPending} onClick={() => redeem.mutate()}>
        Continue to your portal
      </Button>
    </AuthShell>
  )
}
