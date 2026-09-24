import { formatDateTime, formatRelativeTime } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Avatar } from './Avatar'

// The messages in a thread, for both sides of the conversation.
//
// This borrows what chat interfaces get right — you can tell at a glance who
// said what, and runs from one person read as one turn — without borrowing the
// bubbles. Two reasons it stops short of looking like a chat app:
//
//  · Support replies within a business day. Bubbles and a live composer imply
//    minutes, and an interface that promises what the business does not deliver
//    makes every reply feel late.
//  · These messages are letters, not chat lines — several sentences explaining
//    an ASIC renewal or an ATO link. Bubbles cap line length and read badly at
//    that size, and threads here carry a subject, which chat has no concept of.
//
// What was here before conveyed the sender with a 2px left border and the words
// "Our team" / "You"; reading the label was the only reliable way to tell.

/** `Inbound` is written by staff; `Outbound` by the client. */
export interface ThreadMessage {
  id?: string
  direction?: string
  body?: string
  createdAt?: string
}

interface Group {
  fromStaff: boolean
  mine: boolean
  at: string | undefined
  messages: ThreadMessage[]
}

export function MessageThread({
  messages,
  viewer,
  counterpartName,
  viewerName,
  className,
}: {
  messages: ThreadMessage[]
  /** Which side is reading — decides whose messages are "yours". */
  viewer: 'client' | 'staff'
  /** The other party: 'Our team' in the portal, the client's name in the console. */
  counterpartName: string
  /** Used only for the avatar on your own turns. */
  viewerName?: string
  className?: string
}) {
  const groups = groupTurns(messages, viewer)

  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {groups.map((group, index) => (
        <li
          key={group.messages[0]?.id ?? index}
          className={cn(
            'flex flex-col gap-2 rounded-lg px-4 py-3',
            // The other party is tinted and full width; your own turns are
            // indented and untinted, so a thread reads as a column of replies
            // rather than two competing blocks of colour.
            group.mine ? 'ml-6 bg-transparent px-0 py-1' : 'bg-surface-sunken',
          )}
        >
          <div className="flex items-center gap-2">
            <Avatar name={group.mine ? viewerName : counterpartName} size="sm" />
            <span className="text-sm font-medium text-ink">
              {group.mine ? 'You' : counterpartName}
            </span>
            {group.at ? (
              <time
                dateTime={group.at}
                title={formatDateTime(group.at)}
                className="text-xs text-ink-faint"
              >
                {formatRelativeTime(group.at)}
              </time>
            ) : null}
          </div>

          {group.messages.map((message, i) => (
            <p
              key={message.id ?? i}
              className="text-sm leading-relaxed whitespace-pre-wrap text-ink"
            >
              {message.body}
            </p>
          ))}
        </li>
      ))}
    </ol>
  )
}

/**
 * Oldest first, with consecutive messages from one sender collapsed into a
 * single turn.
 *
 * The order matters: both pages rendered `thread.messages` exactly as the API
 * returned it, with nothing guaranteeing chronological sequence — a thread
 * could read out of order and the reply box would not follow the newest
 * message.
 */
function groupTurns(messages: ThreadMessage[], viewer: 'client' | 'staff'): Group[] {
  const ordered = [...messages].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  return ordered.reduce<Group[]>((groups, message) => {
    const fromStaff = message.direction === 'Inbound'
    const mine = viewer === 'staff' ? fromStaff : !fromStaff
    const last = groups[groups.length - 1]

    if (last && last.fromStaff === fromStaff) {
      last.messages.push(message)
      return groups
    }

    groups.push({ fromStaff, mine, at: message.createdAt, messages: [message] })
    return groups
  }, [])
}
