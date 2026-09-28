import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getMessageThreadsOptions,
  getMessageThreadsQueryKey,
  markThreadReadMutation,
  replyToThreadMutation,
  startThreadMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import type { ThreadDto } from '@/api/generated'
import { useAuth } from '@/auth/AuthContext'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import {
  Accordion,
  Button,
  Dialog,
  EmptyState,
  MessageThread,
  ErrorState,
  Field,
  PageHeader,
  Skeleton,
  toastError,
  toastSuccess,
} from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// A support inbox for a relationship that produces a handful of threads a year.
// The turns inside a thread render as chat bubbles — see MessageThread in
// src/ui for how runs, days and alignment work.
//
// What changed and why:
//
//  · The compose form no longer occupies the top of the page. If support had
//    replied to you, their reply was below a form you had to scroll past. New
//    conversations start from a button; your messages come first.
//  · Replying happens inside the open thread. Every thread used to render its
//    own always-visible reply box, so a page of three conversations showed
//    three empty textareas.
//  · Opening a thread marks it read. It was a badge-shaped button you had to
//    find and click, which is not what "read" means.
//  · Threads sort by unread first, then by recency, and only the newest is
//    open on arrival.
// ─────────────────────────────────────────────────────────────────────────────

const newThreadSchema = z.object({
  subject: z.string().trim().min(1, 'Give it a subject so we can route it quickly.'),
  body: z.string().trim().min(1, 'Tell us what you need help with.'),
})

const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply before sending.'),
})

type NewThreadForm = z.infer<typeof newThreadSchema>
type ReplyForm = z.infer<typeof replySchema>

function ThreadReply({ threadId, onSent }: { threadId: string; onSent: () => void }) {
  const form = useForm<ReplyForm>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })

  const reply = useMutation({
    ...replyToThreadMutation(),
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
      onSubmit={form.handleSubmit((values) => reply.mutate({ path: { threadId }, body: values }))}
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

export function MessagesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const threads = useQuery(getMessageThreadsOptions())
  const [composing, setComposing] = useState(false)
  const [openThreads, setOpenThreads] = useState<string[] | null>(null)
  const markedRef = useRef(new Set<string>())

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getMessageThreadsQueryKey() })

  const markRead = useMutation({ ...markThreadReadMutation(), onSuccess: invalidate })

  // Only the avatar on your own turns needs this; the label stays "You".
  const viewerName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (user?.email ?? '')

  const start = useMutation({
    ...startThreadMutation(),
    onSuccess: async () => {
      await invalidate()
      setComposing(false)
      newThreadForm.reset({ subject: '', body: '' })
      toastSuccess('Message sent', 'We usually reply within one business day.')
    },
    onError: () => toastError('Couldn’t send that message', 'Try again in a moment.'),
  })

  const newThreadForm = useForm<NewThreadForm>({
    resolver: zodResolver(newThreadSchema),
    defaultValues: { subject: '', body: '' },
  })

  // Unread first, then most recent. Someone opening this page is nearly always
  // looking for the thing they haven't read.
  const list: ThreadDto[] = [...(threads.data ?? [])].sort((a, b) => {
    const unreadDiff = (Number(b.unreadForClient) || 0) - (Number(a.unreadForClient) || 0)
    if (unreadDiff !== 0) return unreadDiff
    return (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '')
  })

  // Open the top thread on arrival, once the data exists.
  const defaultOpen = list[0]?.threadId
  const value = openThreads ?? (defaultOpen ? [defaultOpen] : [])

  // Opening a thread is reading it. The dependency is a joined string rather
  // than the arrays themselves, which are rebuilt on every render and would
  // otherwise re-run this effect continuously.
  const unreadOpenIds = value
    .filter((id) => Number(list.find((t) => t.threadId === id)?.unreadForClient) > 0)
    .join(',')
  const markReadMutate = markRead.mutate

  useEffect(() => {
    if (!unreadOpenIds) return
    for (const threadId of unreadOpenIds.split(',')) {
      if (markedRef.current.has(threadId)) continue
      markedRef.current.add(threadId)
      markReadMutate({ path: { threadId } })
    }
  }, [unreadOpenIds, markReadMutate])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description="Your conversations with our support team."
        actions={<Button onClick={() => setComposing(true)}>New conversation</Button>}
      />

      {threads.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : threads.isError ? (
        <ErrorState
          description="We couldn’t load your messages just now."
          action={
            <Button variant="secondary" onClick={() => void threads.refetch()}>
              Try again
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Ask us anything about your business names, renewals or ABN — we usually reply within one business day."
          action={<Button onClick={() => setComposing(true)}>Start a conversation</Button>}
        />
      ) : (
        <Accordion.Root
          multiple
          value={value}
          onValueChange={(details) => setOpenThreads(details.value)}
        >
          {list.map((thread) => {
            const unread = Number(thread.unreadForClient) || 0
            return (
              <Accordion.Item key={thread.threadId} value={thread.threadId ?? ''}>
                <Accordion.Trigger>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'font-display block truncate text-lg leading-tight',
                        unread > 0 ? 'font-medium text-ink' : 'font-normal text-ink-muted',
                      )}
                    >
                      {thread.subject}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {formatDateTime(thread.lastActivityAt)}
                    </span>
                  </span>
                  {unread > 0 ? (
                    <span className="size-2 shrink-0 rounded-full bg-accent-600" aria-label={`${unread} unread`} />
                  ) : null}
                  <Accordion.Indicator />
                </Accordion.Trigger>

                <Accordion.Content>
                  <MessageThread
                    className="pb-4"
                    viewer="client"
                    counterpartName="Our team"
                    viewerName={viewerName}
                    messages={thread.messages ?? []}
                  />

                  {thread.threadId ? (
                    <ThreadReply threadId={thread.threadId} onSent={() => void invalidate()} />
                  ) : null}
                </Accordion.Content>
              </Accordion.Item>
            )
          })}
        </Accordion.Root>
      )}

      <Dialog
        open={composing}
        onOpenChange={(open) => {
          setComposing(open)
          if (!open) newThreadForm.reset({ subject: '', body: '' })
        }}
        title="New conversation"
        description="We usually reply within one business day."
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
            <Button
              loading={start.isPending}
              onClick={newThreadForm.handleSubmit((values) => start.mutate({ body: values }))}
            >
              Send message
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={newThreadForm.handleSubmit((values) => start.mutate({ body: values }))}
          noValidate
        >
          <Field label="Subject" required error={newThreadForm.formState.errors.subject?.message}>
            <Field.Input placeholder="What can we help with?" {...newThreadForm.register('subject')} />
          </Field>
          <Field label="Message" required error={newThreadForm.formState.errors.body?.message}>
            <Field.Textarea rows={5} {...newThreadForm.register('body')} />
          </Field>
        </form>
      </Dialog>
    </div>
  )
}
