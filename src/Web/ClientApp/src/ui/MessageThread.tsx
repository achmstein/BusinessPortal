import { formatDate, formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Avatar } from './Avatar'

// The messages in a thread, for both sides of the conversation, rendered the
// way chat apps do: your own messages on the right in the accent colour, the
// other party's on the left in a neutral bubble beside their avatar.
//
//  · Consecutive messages from one sender form a run. Bubbles in a run stack
//    tightly and square off the corners that face each other, so the run reads
//    as one turn; the avatar and time appear once, at the end of the run.
//  · A divider marks each new day, so a thread that spans weeks still reads in
//    order without a date on every bubble.
//  · Bubbles cap at ~80% of the width. Replies here can be several sentences
//    about an ASIC renewal, so the cap is generous rather than phone-narrow.

/** `Inbound` is written by staff; `Outbound` by the client. */
export interface ThreadMessage {
  id?: string
  direction?: string
  body?: string
  createdAt?: string
}

interface Run {
  mine: boolean
  day: string
  messages: ThreadMessage[]
}

const TIME = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' })

function timeOf(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : TIME.format(date)
}

function dayLabel(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((start(new Date()) - start(date)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return formatDate(date)
}

export function MessageThread({
  messages,
  viewer,
  counterpartName,
  className,
}: {
  messages: ThreadMessage[]
  /** Which side is reading — decides whose messages are "yours". */
  viewer: 'client' | 'staff'
  /** The other party: 'Our team' in the portal, the client's name in the console. */
  counterpartName: string
  /** Kept for callers; your own turns no longer show an avatar. */
  viewerName?: string
  className?: string
}) {
  const runs = groupRuns(messages, viewer)

  return (
    <ol className={cn('flex flex-col gap-4', className)}>
      {runs.map((run, index) => {
        const newDay = index === 0 || runs[index - 1].day !== run.day
        const last = run.messages[run.messages.length - 1]
        return (
          <li key={run.messages[0]?.id ?? index} className="flex flex-col gap-4">
            {newDay && run.day ? (
              <div role="separator" className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-rule" />
                {run.day}
                <span className="h-px flex-1 bg-rule" />
              </div>
            ) : null}

            <div className={cn('flex items-end gap-2', run.mine ? 'justify-end' : 'justify-start')}>
              {run.mine ? null : (
                <Avatar name={counterpartName} size="sm" className="mb-5 shrink-0" />
              )}

              <div className={cn('flex max-w-[80%] flex-col gap-0.5', run.mine ? 'items-end' : 'items-start')}>
                {run.mine ? null : (
                  <span className="mb-0.5 px-1 text-xs font-medium text-ink-muted">{counterpartName}</span>
                )}
                {run.messages.map((message, i) => {
                  const first = i === 0
                  const end = i === run.messages.length - 1
                  return (
                    <p
                      key={message.id ?? i}
                      title={formatDateTime(message.createdAt)}
                      className={cn(
                        'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap',
                        run.mine
                          ? 'bg-accent-600 text-paper'
                          : 'bg-surface-sunken text-ink ring-1 ring-rule ring-inset',
                        // Square off the corners that face the rest of the run.
                        run.mine
                          ? cn(!first && 'rounded-tr-md', !end && 'rounded-br-md', end && 'rounded-br-sm')
                          : cn(!first && 'rounded-tl-md', !end && 'rounded-bl-md', end && 'rounded-bl-sm'),
                      )}
                    >
                      {message.body}
                    </p>
                  )
                })}
                {last?.createdAt ? (
                  <time
                    dateTime={last.createdAt}
                    title={formatDateTime(last.createdAt)}
                    className="mt-0.5 px-1 text-[0.6875rem] text-ink-faint"
                  >
                    {run.mine ? 'You · ' : ''}
                    {timeOf(last.createdAt)}
                  </time>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Oldest first, with consecutive messages from one sender on the same day
 * collapsed into a single run.
 *
 * The order matters: both pages rendered `thread.messages` exactly as the API
 * returned it, with nothing guaranteeing chronological sequence — a thread
 * could read out of order and the reply box would not follow the newest
 * message.
 */
function groupRuns(messages: ThreadMessage[], viewer: 'client' | 'staff'): Run[] {
  const ordered = [...messages].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  return ordered.reduce<Run[]>((runs, message) => {
    const fromStaff = message.direction === 'Inbound'
    const mine = viewer === 'staff' ? fromStaff : !fromStaff
    const day = dayLabel(message.createdAt)
    const last = runs[runs.length - 1]

    if (last && last.mine === mine && last.day === day) {
      last.messages.push(message)
      return runs
    }

    runs.push({ mine, day, messages: [message] })
    return runs
  }, [])
}
