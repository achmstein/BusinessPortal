import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { postApiResetPassword } from '../api/generated'

// Markup ported verbatim from the original app/reset-password/page.tsx. The
// emailed link carries ?email=…&code=… (Identity's reset code instead of the
// original PasswordReset token); submit hits /api/resetPassword.
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const email = params.get('email') || ''
  const code = params.get('code') || ''
  // The original validated the token up-front; Identity can only check on
  // submit, so up-front we can only catch a missing/mangled link.
  const valid = !!email && !!code

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') || '')
    const confirm = String(form.get('confirm') || '')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await postApiResetPassword({ body: { email, resetCode: code, newPassword: password } })
      navigate('/login?error=Password+updated.+Please+sign+in.')
    } catch {
      navigate('/forgot-password?error=Reset+link+is+invalid+or+expired.+Request+a+new+one.')
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-navy-50">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BrandLockup />
        </div>
        <div className="card-pad">
          <h1 className="text-2xl font-bold text-navy-900">Choose a new password</h1>

          {!valid ? (
            <>
              <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
                This reset link is invalid or has expired.
              </div>
              <p className="mt-6 text-sm text-navy-600 text-center">
                <Link to="/forgot-password" className="text-brand-700 font-semibold hover:underline">
                  Request a new reset link
                </Link>
              </p>
            </>
          ) : (
            <>
              {error ? (
                <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
                  {error}
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="label" htmlFor="password">New password</label>
                  <input id="password" name="password" type="password" minLength={8} required className="input" placeholder="At least 8 characters" />
                </div>
                <div>
                  <label className="label" htmlFor="confirm">Confirm password</label>
                  <input id="confirm" name="confirm" type="password" minLength={8} required className="input" />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
