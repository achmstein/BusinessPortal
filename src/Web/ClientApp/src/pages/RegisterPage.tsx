import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { registerAccount } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { AuthShell } from '@/components/AuthShell'
import { Button, Field, PasswordInput } from '@/ui'

// Most people never see this page — an account is created for them when they
// renew a business name. So it opens by saying so: someone who already has an
// account and doesn't realise it would otherwise register a second one under a
// different address and find none of their records in it.

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('That doesn’t look like an email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

type RegisterForm = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const form = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  })

  const create = useMutation({
    mutationFn: (values: RegisterForm) =>
      registerAccount({ body: { ...values, email: values.email.toLowerCase() } }),
    onSuccess: async () => {
      await refresh()
      navigate('/', { replace: true })
    },
    onError: () => {
      form.setError('email', {
        message: 'We couldn’t create that account. You may already have one — try signing in instead.',
      })
    },
  })

  return (
    <AuthShell
      title="Create an account"
      description="If you’ve renewed a business name with us before, you already have one — sign in rather than creating a second."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-accent-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" required error={form.formState.errors.firstName?.message}>
            <Field.Input autoComplete="given-name" autoFocus {...form.register('firstName')} />
          </Field>
          <Field label="Last name" required error={form.formState.errors.lastName?.message}>
            <Field.Input autoComplete="family-name" {...form.register('lastName')} />
          </Field>
        </div>

        <Field
          label="Email"
          required
          hint="Use the address you gave us when you renewed."
          error={form.formState.errors.email?.message}
        >
          <Field.Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>

        <Field
          label="Password"
          required
          hint="At least 8 characters."
          error={form.formState.errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        <Button type="submit" size="lg" loading={create.isPending} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
