import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { postApiForgotPassword } from '../api/generated'

// Markup ported verbatim from the original app/forgot-password/page.tsx. The
// requestReset server action becomes a client submit against Identity's
// /api/forgotPassword; the emailed link carries the reset code.
export function ForgotPasswordPage() {
  const [params, setParams] = useSearchParams()
  const [submitting, setSubmitting] = useState(false)
  const error = params.get('error')
  const ok = params.get('ok')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') || '').trim().toLowerCase()
    if (!email) {
      setParams({ error: 'Please enter your email' })
      return
    }
    setSubmitting(true)
    try {
      await postApiForgotPassword({ body: { email } })
    } catch { /* same response either way — don't leak which emails exist */ }
    setSubmitting(false)
    // Always show the same response regardless of whether the email matched.
    setParams({ ok: 'If the email is registered, a reset link has been sent.' })
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-navy-50">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BrandLockup />
        </div>
        <div className="card-pad">
          <h1 className="text-2xl font-bold text-navy-900">Forgot your password?</h1>
          <p className="mt-1 text-sm text-navy-500">
            Enter your email and we'll send you a link to set a new password.
          </p>

          {error ? (
            <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
              {error}
            </div>
          ) : null}
          {ok ? (
            <div className="mt-6 rounded-lg bg-accent-50 border border-accent-200 text-accent-800 text-sm px-4 py-2.5">
              {ok}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-6 text-sm text-navy-600 text-center">
            <Link to="/login" className="text-brand-700 font-semibold hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
