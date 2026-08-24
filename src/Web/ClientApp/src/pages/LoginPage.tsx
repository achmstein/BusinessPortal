import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getMe, postApiLogin } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { AuthShell } from '@/components/AuthShell'
import { Button, Field } from '@/ui'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter the email address we contact you on.').email('That doesn’t look like an email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

type LoginForm = z.infer<typeof schema>

interface FromState {
  from?: { pathname?: string }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useAuth()
  const [params] = useSearchParams()

  // Set after a successful password reset, so the person knows the reset worked
  // rather than wondering why they're back at the sign-in screen.
  const notice = params.get('notice')

  const form = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const signIn = useMutation({
    mutationFn: async (values: LoginForm) => {
      await postApiLogin({
        query: { useCookies: true },
        body: { email: values.email.toLowerCase(), password: values.password },
      })
      await refresh()
      const { data } = await getMe()
      return data
    },
    onSuccess: (me) => {
      // Return the person to whatever they were trying to reach before the
      // guard sent them here.
      const intended = (location.state as FromState | null)?.from?.pathname
      navigate(intended ?? (me?.isAdmin ? '/admin' : '/dashboard'), { replace: true })
    },
    onError: () => {
      form.setError('password', { message: 'That email and password don’t match an account.' })
    },
  })

  return (
    <AuthShell
      title="Sign in"
      description={
        <>
          If you renewed a business name with us, an account was created for you — use the same email
          address.
        </>
      }
      footer={
        <>
          Don’t have an account yet?{' '}
          <Link to="/register" className="text-bottle-600 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {notice ? (
        <p className="rounded-sm bg-bottle-50 px-4 py-2.5 text-sm text-bottle-700 ring-1 ring-bottle-100" role="status">
          {notice}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
        noValidate
      >
        <Field label="Email" required error={form.formState.errors.email?.message}>
          <Field.Input
            type="email"
            autoComplete="email"
            autoFocus
            {...form.register('email')}
            placeholder="you@yourbusiness.com.au"
          />
        </Field>

        <Field label="Password" required error={form.formState.errors.password?.message}>
          <Field.Input type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>

        <Button type="submit" size="lg" loading={signIn.isPending} className="mt-1 w-full">
          Sign in
        </Button>

        <Link to="/forgot-password" className="self-start text-sm text-bottle-600 hover:underline">
          I’ve forgotten my password
        </Link>
      </form>
    </AuthShell>
  )
}
