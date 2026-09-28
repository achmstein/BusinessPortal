import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from './Button'
import { Field } from './Field'

// The reply composer at the foot of a conversation, shared by the client
// portal and the admin console. The caller owns the request; the box clears
// itself only once `onSend` resolves, so a failed send keeps the text.

const schema = z.object({ body: z.string().trim().min(1, 'Write a reply before sending.') })

export function ReplyBox({
  onSend,
  sending,
}: {
  onSend: (body: string) => Promise<unknown>
  sending: boolean
}) {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { body: '' } })

  return (
    <form
      className="flex flex-col gap-3 border-t border-rule pt-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSend(values.body)
          form.reset({ body: '' })
        } catch {
          // The caller reports the error; keep what was typed.
        }
      })}
      noValidate
    >
      <Field label="Reply" error={form.formState.errors.body?.message}>
        <Field.Textarea rows={3} placeholder="Type your reply…" {...form.register('body')} />
      </Field>
      <Button type="submit" className="self-end" loading={sending}>
        Send reply
      </Button>
    </form>
  )
}
