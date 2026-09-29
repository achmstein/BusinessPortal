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
// ─────────────────────────────────────────────────────────────────────────────

type Reason = 'expired' | 'used' | 'invalid' | 'not-ready'

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
  'not-ready': {
    title: 'Your account is nearly ready',
    description: 'We’re still setting up your portal from your renewal. Try this link again in a few minutes.',
  },
}

export function SignInLinkPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const token = params.get('t') ?? ''

  const redeem = useMutation({
    mutationFn: async () => {
      const result = await redeemSignInLink({ body: { token } })
      if (result.error) throw (result.error as { reason?: Reason }).reason ?? 'invalid'
    },
    onSuccess: async () => {
      await refresh()
      navigate('/', { replace: true })
    },
  })

  const reason: Reason | null = !token ? 'invalid' : redeem.isError ? ((redeem.error as unknown as Reason) ?? 'invalid') : null
  const problem = reason ? PROBLEMS[reason] : null

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
