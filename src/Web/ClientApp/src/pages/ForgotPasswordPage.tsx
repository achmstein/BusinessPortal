import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { postApiForgotPassword } from '@/api/generated'
import { AuthShell } from '@/components/AuthShell'
import { Button, Field } from '@/ui'

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('That doesn’t look like an email address.'),
})

type ForgotForm = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const form = useForm<ForgotForm>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const request = useMutation({
    mutationFn: async (values: ForgotForm) => {
      try {
        await postApiForgotPassword({ body: { email: values.email.toLowerCase() } })
      } catch {
        // Deliberately identical outcome either way. Surfacing a failure here
        // would let anyone test which of your customers' addresses have
        // accounts, so the request never reports whether it matched one.
      }
    },
  })

  // A confirmation replaces the form rather than stacking a banner above a form
  // that still invites another submit.
  if (request.isSuccess) {
    const email = form.getValues('email')
    return (
      <AuthShell
        title="Check your email"
        description={
          <>
            If <strong className="font-medium text-ink">{email}</strong> has an account, a link to choose a
            new password is on its way. It works for 48 hours.
          </>
        }
        footer={
          <>
            Nothing arrived? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => request.reset()}
              className="text-bottle-600 underline-offset-2 hover:underline"
            >
              try a different address
            </button>
            .
          </>
        }
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      description="We’ll email you a link to choose a new one."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="text-bottle-600 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => request.mutate(values))}
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

        <Button type="submit" size="lg" loading={request.isPending} className="mt-1 w-full">
          Email me a link
        </Button>
      </form>
    </AuthShell>
  )
}
