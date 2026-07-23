import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { registerAccount } from '../api/generated'
import { useAuth } from '../auth/AuthContext'

// Markup ported verbatim from the original app/register/page.tsx. The server
// action is replaced by a client submit against /api/account/register, which
// seeds the profile + welcome message and starts the session.
export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const form = new FormData(e.currentTarget)
    try {
      await registerAccount({
        body: {
          firstName: String(form.get('firstName') || '').trim(),
          lastName: String(form.get('lastName') || '').trim(),
          email: String(form.get('email') || '').trim().toLowerCase(),
          password: String(form.get('password') || ''),
        },
      })
      await refresh()
      navigate('/dashboard')
    } catch (e) {
      const message = (e as { error?: string })?.error
      setError(message || 'Could not create the account. Try again shortly.')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-navy-900 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-accent-500/20 blur-3xl" />
        <BrandLockup inverted />
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">
            Set up your business portal in under a minute.
          </h1>
          <p className="mt-4 text-navy-300 max-w-md">
            Free to create. Everything saved securely to your account, ready
            when you log back in from any device.
          </p>
        </div>
        <div className="relative text-xs text-navy-400">
          © {new Date().getFullYear()} Business Portal
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <BrandLockup />
          </div>
          <h2 className="text-2xl font-bold text-navy-900">Create your account</h2>
          <p className="mt-1 text-sm text-navy-500">
            Just the basics — you can fill in the rest after you log in.
          </p>

          {error ? (
            <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="form-grid">
              <div>
                <label className="label" htmlFor="firstName">First name</label>
                <input id="firstName" name="firstName" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="lastName">Last name</label>
                <input id="lastName" name="lastName" required className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" placeholder="you@business.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" minLength={6} required className="input" placeholder="At least 6 characters" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-navy-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
