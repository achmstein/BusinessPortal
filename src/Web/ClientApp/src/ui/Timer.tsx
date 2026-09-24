import { Timer as ArkTimer } from '@ark-ui/react/timer'
import { cn } from '@/lib/cn'

/**
 * A countdown to a deadline.
 *
 * The ATO link screen ran its own `setInterval` decrementing a piece of state.
 * That drifts, and a backgrounded tab throttles the interval without ever
 * resyncing — so against the ATO's real five-minute approval window it could
 * tell someone they had a minute left when the window had already closed.
 *
 * Ark drives this from wall-clock time, so it stays honest across tab
 * throttling, and `Timer.Area` puts the value in a labelled live region rather
 * than leaving it as decoration a screen reader never reads.
 */
export function Countdown({
  seconds,
  urgentAt = 60,
  onComplete,
  className,
}: {
  /** Total to count down from. */
  seconds: number
  /** At or below this many seconds remaining, the value turns urgent. */
  urgentAt?: number
  onComplete?: () => void
  className?: string
}) {
  return (
    <ArkTimer.Root countdown startMs={seconds * 1000} autoStart onComplete={onComplete}>
      <ArkTimer.Context>
        {(api) => {
          const left = api.time.minutes * 60 + api.time.seconds
          return (
            <ArkTimer.Area
              data-numeric
              className={cn(
                'font-medium tabular-nums',
                left <= urgentAt ? 'text-danger-600' : 'text-ink',
                className,
              )}
            >
              {api.formattedTime.minutes}:{api.formattedTime.seconds}
            </ArkTimer.Area>
          )
        }}
      </ArkTimer.Context>
    </ArkTimer.Root>
  )
}
