// Dates in this app arrive from the API as plain 'yyyy-MM-dd' strings (ASIC
// registration and renewal dates) or as ISO timestamps (messages, audit rows).
// Formatting used to be ~20 ad-hoc `new Date(x).toLocaleDateString()` calls
// with no shared locale, so the same date could render two ways on two screens.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parse a 'yyyy-MM-dd' date into local midnight.
 *
 * `new Date('2026-03-12')` is parsed as UTC midnight, which is the *previous*
 * day in any negative-offset zone and shifts day-count arithmetic in Australia
 * too. Constructing the parts explicitly keeps a calendar date a calendar date.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = DATE_ONLY.exec(value.trim())
  if (!match) {
    const loose = new Date(value)
    return Number.isNaN(loose.getTime()) ? null : loose
  }
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Today at local midnight — the reference point for every day count. */
export function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const WITH_TIME = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** '12 Mar 2027'. Returns an em dash for missing or unparseable input. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDateOnly(value)
  return date ? DAY_MONTH_YEAR.format(date) : '—'
}

/** '12 Mar 2027, 4:05 pm'. For message and audit timestamps. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : WITH_TIME.format(date)
}

/** 'in 24 days' / '22 days ago' / 'today'. */
export function formatRelativeDays(days: number): string {
  if (days === 0) return 'today'
  const magnitude = Math.abs(days)
  const unit = magnitude === 1 ? 'day' : 'days'
  return days > 0 ? `in ${magnitude} ${unit}` : `${magnitude} ${unit} ago`
}
