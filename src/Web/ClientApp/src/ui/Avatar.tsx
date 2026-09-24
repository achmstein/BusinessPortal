import { Avatar as ArkAvatar } from '@ark-ui/react/avatar'
import { cn } from '@/lib/cn'

/**
 * Initials in a circle. No uploaded images exist anywhere in this product, so
 * the fallback is the whole component — Ark's image handling is kept because
 * `src` will eventually arrive, and because its fallback only hides once the
 * image has actually decoded, which avoids the flash of empty circle.
 */
export function Avatar({
  name,
  firstName,
  lastName,
  email,
  src,
  size = 'md',
  className,
}: {
  /** A full display name, where that is all the endpoint returns. */
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  /** Used for initials when no name is on record — many accounts have only this. */
  email?: string | null
  src?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  const initials = getInitials({ name, firstName, lastName, email })

  return (
    <ArkAvatar.Root
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full',
        'bg-accent-50 font-medium text-accent-700 select-none',
        size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm',
        className,
      )}
    >
      <ArkAvatar.Fallback>{initials}</ArkAvatar.Fallback>
      {src ? <ArkAvatar.Image src={src} alt="" className="size-full object-cover" /> : null}
    </ArkAvatar.Root>
  )
}

/**
 * Same precedence the shells already use to build a display name: given/family
 * name if we hold both parts, then a whole-name string where that is all an
 * endpoint returns, then the email — so a row is never a blank circle.
 */
function getInitials({
  name,
  firstName,
  lastName,
  email,
}: {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}): string {
  const first = (firstName ?? '').trim()
  const last = (lastName ?? '').trim()
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()

  // Two words in, two initials out; one word gives one. Splitting a full name
  // is only ever a guess, so it stays this crude on purpose.
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
  }

  return (email ?? '').trim().charAt(0).toUpperCase() || '?'
}
