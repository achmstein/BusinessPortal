/**
 * Shown while the session is being confirmed on first load.
 *
 * Deliberately near-silent: this resolves in a few hundred milliseconds, and a
 * spinner that flashes on every load reads as slower than nothing at all. The
 * live region means screen readers still hear that something is in progress.
 */
export function AuthPending() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper" role="status" aria-live="polite">
      <span className="sr-only">Checking your sign-in…</span>
    </div>
  )
}
