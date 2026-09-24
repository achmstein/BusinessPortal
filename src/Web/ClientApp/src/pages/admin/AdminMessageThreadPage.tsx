import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, UserRound } from 'lucide-react'
import {
  adminMarkAllReadMutation,
  adminReplyToClientMutation,
  getAdminClientThreadsOptions,
  getAdminClientThreadsQueryKey,
  getAdminMessagesQueryKey,
  getAdminOverviewQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { formatDateTime } from '@/lib/dates'
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  MessageThread,
  PageHeader,
  Panel,
  Skeleton,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Replying to one client.
//
// Opening this page marks their messages read, which is the honest meaning of
// "read" and removes the separate button staff had to remember to press. The
// badge in the sidebar and the inbox both re-fetch afterwards, so the unread
// count can't disagree with what's on screen.
//
// The reply box lives at the bottom of the conversation it belongs to, and
// starting a new subject is a dialog rather than a second form competing for
// attention above the thread.
// ─────────────────────────────────────────────────────────────────────────────

const replySchema = z.object({ body: z.string().trim().min(1, 'Write a reply before sending.') })
const newSchema = z.object({
  subject: z.string().trim().min(1, 'Give it a subject.'),
  body: z.string().trim().min(1, 'Write the message.'),
})

type ReplyForm = z.infer<typeof replySchema>
type NewForm = z.infer<typeof newSchema>

function Reply({
  clientId,
  threadId,
  subject,
  onSent,
}: {
  clientId: string
  threadId: string
  subject: string
  onSent: () => void
}) {
  const form = useForm<ReplyForm>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })

  const reply = useMutation({
    ...adminReplyToClientMutation(),
    onSuccess: () => {
      form.reset({ body: '' })
      onSent()
      toastSuccess('Reply sent')
    },
    onError: () => toastError('Couldn’t send that reply', 'Try again in a moment.'),
  })

  return (
    <form
      className="flex flex-col gap-3 border-t border-rule pt-4"
      onSubmit={form.handleSubmit((values) =>
        reply.mutate({ path: { id: clientId }, body: { threadId, subject, body: values.body } }),
      )}
      noValidate
    >
      <Field label="Reply" error={form.formState.errors.body?.message}>
        <Field.Textarea rows={3} placeholder="Type your reply…" {...form.register('body')} />
      </Field>
      <Button type="submit" size="sm" className="self-end" loading={reply.isPending}>
        Send reply
      </Button>
    </form>
  )
}

export function AdminMessageThreadPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const queryClient = useQueryClient()
  const [composing, setComposing] = useState(false)

  const conversation = useQuery(getAdminClientThreadsOptions({ path: { clientId: clientId! } }))

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getAdminClientThreadsQueryKey({ path: { clientId: clientId! } }) }),
      queryClient.invalidateQueries({ queryKey: getAdminMessagesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getAdminOverviewQueryKey() }),
    ])
  }

  const markAllRead = useMutation({ ...adminMarkAllReadMutation(), onSuccess: refresh })
  const markAllReadMutate = markAllRead.mutate

  const unread = (conversation.data?.threads ?? []).reduce(
    (n, thread) => n + Number(thread.unreadForAdmin ?? 0),
    0,
  )

  // Opening the conversation is reading it.
  useEffect(() => {
    if (unread > 0 && clientId) markAllReadMutate({ path: { clientId } })
  }, [unread, clientId, markAllReadMutate])

  const newForm = useForm<NewForm>({ resolver: zodResolver(newSchema), defaultValues: { subject: '', body: '' } })

  const start = useMutation({
    ...adminReplyToClientMutation(),
    onSuccess: async () => {
      await refresh()
      setComposing(false)
      newForm.reset({ subject: '', body: '' })
      toastSuccess('Message sent')
    },
    onError: () => toastError('Couldn’t send that message', 'Try again in a moment.'),
  })

  if (conversation.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (conversation.isError || !conversation.data) {
    return (
      <ErrorState
        description="We couldn’t open this conversation."
        action={
          <Button asChild variant="secondary">
            <Link to="/admin/messages">Back to the inbox</Link>
          </Button>
        }
      />
    )
  }

  const client = conversation.data
  const name = client.name || client.email || 'Client'
  const threads = [...(client.threads ?? [])].sort((a, b) =>
    (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''),
  )

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/messages"
        className="inline-flex items-center gap-1.5 self-start text-sm text-accent-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Inbox
      </Link>

      <PageHeader
        title={name}
        description={client.email ?? undefined}
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to={`/admin/clients/${client.id}`}>
                <UserRound aria-hidden className="size-4" />
                Client record
              </Link>
            </Button>
            <Button onClick={() => setComposing(true)}>New message</Button>
          </>
        }
      />

      {threads.length === 0 ? (
        <EmptyState
          title="No conversation yet"
          description={`Nothing has been sent to or from ${name}.`}
          action={<Button onClick={() => setComposing(true)}>Send the first message</Button>}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {threads.map((thread) => (
            <Panel key={thread.threadId} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg leading-tight font-medium text-ink">{thread.subject}</h2>
                <span className="text-xs text-ink-faint">{formatDateTime(thread.lastActivityAt)}</span>
              </div>

              <MessageThread
                viewer="staff"
                counterpartName={name}
                messages={thread.messages ?? []}
              />

              <Reply
                clientId={client.id}
                threadId={thread.threadId ?? ''}
                subject={thread.subject ?? ''}
                onSent={() => void refresh()}
              />
            </Panel>
          ))}
        </div>
      )}

      <Dialog
        open={composing}
        onOpenChange={(open) => {
          setComposing(open)
          if (!open) newForm.reset({ subject: '', body: '' })
        }}
        title={`New message to ${name}`}
        description="This starts a new conversation rather than replying to an existing one."
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button
              loading={start.isPending}
              onClick={newForm.handleSubmit((values) =>
                start.mutate({ path: { id: client.id }, body: { threadId: null, ...values } }),
              )}
            >
              Send message
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={newForm.handleSubmit((values) =>
            start.mutate({ path: { id: client.id }, body: { threadId: null, ...values } }),
          )}
          noValidate
        >
          <Field label="Subject" required error={newForm.formState.errors.subject?.message}>
            <Field.Input {...newForm.register('subject')} />
          </Field>
          <Field label="Message" required error={newForm.formState.errors.body?.message}>
            <Field.Textarea rows={5} {...newForm.register('body')} />
          </Field>
        </form>
      </Dialog>
    </div>
  )
}
