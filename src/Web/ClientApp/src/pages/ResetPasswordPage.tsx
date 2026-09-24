import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { postApiResetPassword } from '@/api/generated'
import { AuthShell } from '@/components/AuthShell'
import { Button, Field, PasswordInput } from '@/ui'

// This screen has two audiences reached by the same link. Someone who forgot
// their password is *re*setting one; someone who was invited after renewing a
// business name is choosing their first. The invite email carries `welcome=1`
// so we don't tell a brand-new customer to pick a "new" password they never had.

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Both passwords need to match.',
    path: ['confirm'],
  })

type ResetForm = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const email = params.get('email') ?? ''
  const code = params.get('code') ?? ''
  const welcome = params.get('welcome') === '1'
  const linkUsable = Boolean(email && code)

  const form = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const submit = useMutation({
    mutationFn: (values: ResetForm) =>
      postApiResetPassword({ body: { email, resetCode: code, newPassword: values.password } }),
    onSuccess: () => {
      const notice = welcome
        ? 'Your password is set — sign in to see your records.'
        : 'Your password has been changed. Sign in with it now.'
      navigate(`/login?notice=${encodeURIComponent(notice)}`, { replace: true })
    },
    onError: () => {
      // Identity can only judge the token on submit, and an expired link is by
      // far the likeliest cause. Say so on the field rather than bouncing the
      // person to another page with an error in the query string.
      form.setError('password', {
        message: 'This link has expired or has already been used. Request a new one below.',
      })
    },
  })

  if (!linkUsable) {
    return (
      <AuthShell
        title="This link won’t work"
        description="The address is missing part of the link — it may have been broken across two lines by your email app."
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">Send me a new link</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={welcome ? 'Choose a password' : 'Choose a new password'}
      description={
        welcome ? (
          <>
            This sets up sign-in for <strong className="font-medium text-ink">{email}</strong>. You’ll use it
            to check your business names and renewal dates.
          </>
        ) : (
          <>
            You’re resetting the password for <strong className="font-medium text-ink">{email}</strong>.
          </>
        )
      }
      footer={
        <>
          Link expired?{' '}
          <Link to="/forgot-password" className="text-accent-600 hover:underline">
            Send a new one
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => submit.mutate(values))}
        noValidate
      >
        <Field
          label="Password"
          required
          hint="At least 8 characters. A short phrase is easier to remember than a jumble."
          error={form.formState.errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        <Field label="Confirm password" required error={form.formState.errors.confirm?.message}>
          <PasswordInput
            autoComplete="new-password"
            invalid={Boolean(form.formState.errors.confirm)}
            {...form.register('confirm')}
          />
        </Field>

        <Button type="submit" size="lg" loading={submit.isPending} className="mt-1 w-full">
          {welcome ? 'Set password and continue' : 'Save new password'}
        </Button>
      </form>
    </AuthShell>
  )
}
