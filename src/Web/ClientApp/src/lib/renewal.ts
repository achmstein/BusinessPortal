import { daysBetween, parseDateOnly, today } from './dates'

// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth for "how urgent is this renewal".
//
// This previously existed twice with DIFFERENT thresholds — the admin registry
// used 30/90 days and the client screen used 60 — so the same business name
// could read "due soon" to staff and "fine" to the customer looking at their
// own record. One function, used by both sides, is the fix.
//
// The bands follow the Registry rule that healthy is quiet: a registration with
// time left carries no colour at all, amber appears inside the renewal window,
// and red only once the date has passed.
// ─────────────────────────────────────────────────────────────────────────────

/** Days before the renewal date that a name is considered due. */
export const RENEWAL_WINDOW_DAYS = 60

export type RenewalTone = 'ok' | 'due' | 'overdue' | 'dormant' | 'unknown'

export interface RenewalStatus {
  tone: RenewalTone
  /** Short label for a badge — 'Registered', 'Renew soon', 'Overdue'. */
  label: string
  /** Whole days until renewal. Negative once overdue. Null if no date. */
  days: number | null
  /** True when the customer needs to act now. Drives emphasis everywhere. */
  needsAction: boolean
}

export function renewalStatus(
  renewalDate: string | null | undefined,
  options: { cancelled?: boolean; now?: Date } = {},
): RenewalStatus {
  if (options.cancelled) {
    return { tone: 'dormant', label: 'Cancelled', days: null, needsAction: false }
  }

  const renews = parseDateOnly(renewalDate)
  if (!renews) {
    return { tone: 'unknown', label: 'No renewal date', days: null, needsAction: false }
  }

  const days = daysBetween(options.now ?? today(), renews)

  if (days < 0) {
    return { tone: 'overdue', label: 'Overdue', days, needsAction: true }
  }
  if (days <= RENEWAL_WINDOW_DAYS) {
    return { tone: 'due', label: 'Renew soon', days, needsAction: true }
  }
  return { tone: 'ok', label: 'Registered', days, needsAction: false }
}

/**
 * The renewal date a name would carry after renewing for `years`.
 *
 * Mirrors RenewalDateMath.Extend on the server: a registration still in date
 * extends from its existing expiry, a lapsed one from today, so renewing late
 * never silently loses the customer time. Kept in step with that method —
 * this is only for showing the outcome before payment; the server decides.
 */
export function extendedRenewalDate(
  renewalDate: string | null | undefined,
  years: number,
  now: Date = today(),
): Date {
  const current = parseDateOnly(renewalDate)
  const base = current && current > now ? current : now
  return new Date(base.getFullYear() + years, base.getMonth(), base.getDate())
}

/**
 * How far through its registration term a name is, as 0–1.
 *
 * Drives the validity band. Falls back to the renewal window alone when the
 * registration date is missing, which is common on names imported from ASIC
 * without a start date.
 */
export function termProgress(
  registeredDate: string | null | undefined,
  renewalDate: string | null | undefined,
  now: Date = today(),
): number | null {
  const renews = parseDateOnly(renewalDate)
  if (!renews) return null

  const registered = parseDateOnly(registeredDate)
  if (!registered || registered >= renews) {
    const remaining = daysBetween(now, renews)
    if (remaining <= 0) return 1
    return Math.max(0, Math.min(1, 1 - remaining / 365))
  }

  const total = daysBetween(registered, renews)
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, daysBetween(registered, now) / total))
}
