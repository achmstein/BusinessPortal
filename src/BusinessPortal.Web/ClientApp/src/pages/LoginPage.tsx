import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLockup } from '../components/Brand'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

// Markup ported verbatim from the original app/login/page.tsx. The server action
// is replaced by a client submit that hits the Identity cookie-login endpoint.
export function LoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    try {
      await api.login(email, password)
      await refresh()
      navigate('/dashboard')
    } catch {
      setError('Invalid email or password')
    } finally {
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
            Everything you need to start, run and grow your business.
          </h1>
          <p className="mt-4 text-navy-300 max-w-md">
            One secure portal for registrations, tax, BAS, insurance, super,
            documents, free tools and direct support.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-navy-200">
            <li>✓ Manage GST, PAYG &amp; business name registrations</li>
            <li>✓ Lodge BAS and start your 2024/25/26 tax return</li>
            <li>✓ Track insurance, super and important documents</li>
            <li>✓ Message support and access free tools instantly</li>
          </ul>
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
          <h2 className="text-2xl font-bold text-navy-900">Welcome back</h2>
          <p className="mt-1 text-sm text-navy-500">
            Sign in to your business portal.
          </p>

          {error ? (
            <div className="mt-6 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="input" placeholder="you@business.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required className="input" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-sm text-right">
            <Link to="/forgot-password" className="text-brand-700 hover:underline">
              Forgot your password?
            </Link>
          </div>

          <p className="mt-6 text-sm text-navy-600">
            New here?{' '}
            <Link to="/register" className="text-brand-700 font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
