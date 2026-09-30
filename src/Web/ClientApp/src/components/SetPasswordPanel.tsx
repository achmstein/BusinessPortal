import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { setPassword } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { Button, Field, Panel, PanelTitle, PasswordInput } from '@/ui'

// Shown to customers whose account the portal created for them (after a renewal)
// and who arrived by a one-click link, so have never chosen a password. Without
// one they're locked out once this browser session ends.

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Both passwords need to match.',
    path: ['confirm'],
  })

type SetPasswordForm = z.infer<typeof schema>

export function SetPasswordPanel() {
  const { user, refresh } = useAuth()
  const [later, setLater] = useState(false)

  const form = useForm<SetPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const submit = useMutation({
    mutationFn: async (values: SetPasswordForm) => {
      const result = await setPassword({ body: { password: values.password } })
      if (result.error) throw new Error((result.error as { error?: string }).error ?? 'Could not set your password.')
    },
    onSuccess: () => refresh(),
    onError: (error: Error) => form.setError('password', { message: error.message }),
  })

  if (!user?.needsPassword || later) return null

  return (
    <Panel className="mb-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <PanelTitle as="h2">Choose a password</PanelTitle>
        <p className="text-sm text-ink-faint">
          So you can sign in with <strong className="font-medium text-ink">{user.email}</strong> next time.
        </p>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit((values) => submit.mutate(values))}
        noValidate
      >
        <Field label="Password" required hint="At least 8 characters." error={form.formState.errors.password?.message}>
          <PasswordInput
            autoComplete="new-password"
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
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={submit.isPending}>
            Save password
          </Button>
          <Button type="button" variant="secondary" onClick={() => setLater(true)}>
            Later
          </Button>
        </div>
      </form>
    </Panel>
  )
}
