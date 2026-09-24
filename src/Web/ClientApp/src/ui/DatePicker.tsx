import { DatePicker as ArkDatePicker, parseDate, type DateValue } from '@ark-ui/react/date-picker'
import { Portal } from '@ark-ui/react/portal'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

// Replaces <input type="date">, whose calendar is browser chrome: it cannot be
// themed, and it looks different in every browser. This one is ours everywhere.
//
// The value crossing this boundary stays an ISO `yyyy-mm-dd` string, which is
// what the form schemas and the API already speak — callers never touch
// @internationalized/date.

const CELL = cn(
  'grid size-9 cursor-pointer place-items-center rounded-md text-sm text-ink transition-colors',
  'hover:bg-surface-sunken',
  'data-[today]:font-semibold data-[today]:text-accent-700',
  'data-[selected]:bg-accent-600 data-[selected]:font-medium data-[selected]:text-paper',
  'data-[outside-range]:text-ink-faint/50',
  'data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-faint/40 data-[disabled]:hover:bg-transparent',
)

const NAV = 'grid size-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken'

const VIEW_TRIGGER =
  'rounded-md px-2 py-1 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken'

export function DatePicker({
  value,
  onChange,
  id,
  disabled,
  invalid,
  className,
}: {
  /** ISO `yyyy-mm-dd`, or '' for empty. */
  value: string
  onChange: (next: string) => void
  id?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  // parseDate throws on a partial string, which is exactly what a half-typed
  // date is — an unparseable value simply means nothing is selected yet.
  let selected: DateValue[] = []
  try {
    if (value) selected = [parseDate(value)]
  } catch {
    selected = []
  }

  return (
    <ArkDatePicker.Root
      value={selected}
      onValueChange={(details) => onChange(details.valueAsString[0] ?? '')}
      disabled={disabled}
      positioning={{ placement: 'bottom-start' }}
      className={className}
    >
      <ArkDatePicker.Control className="relative flex">
        <ArkDatePicker.Input
          id={id}
          className={cn(
            'block h-10 w-full rounded-md border bg-surface pr-10 pl-3 text-sm text-ink',
            'placeholder:text-ink-faint/70 transition-colors',
            'focus:outline-none focus-visible:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500/30',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint',
            invalid ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-rule-firm',
          )}
        />
        <ArkDatePicker.Trigger
          aria-label="Open calendar"
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <CalendarDays aria-hidden className="size-4" />
        </ArkDatePicker.Trigger>
      </ArkDatePicker.Control>

      <Portal>
        <ArkDatePicker.Positioner>
          <ArkDatePicker.Content className="z-50 rounded-xl border border-rule bg-surface p-3 shadow-overlay focus:outline-none">
            <ArkDatePicker.View view="day">
              <ArkDatePicker.Context>
                {(api) => (
                  <>
                    <ArkDatePicker.ViewControl className="mb-2 flex items-center justify-between gap-2">
                      <ArkDatePicker.PrevTrigger aria-label="Previous month" className={NAV}>
                        <ChevronLeft aria-hidden className="size-4" />
                      </ArkDatePicker.PrevTrigger>
                      <ArkDatePicker.ViewTrigger className={VIEW_TRIGGER}>
                        <ArkDatePicker.RangeText />
                      </ArkDatePicker.ViewTrigger>
                      <ArkDatePicker.NextTrigger aria-label="Next month" className={NAV}>
                        <ChevronRight aria-hidden className="size-4" />
                      </ArkDatePicker.NextTrigger>
                    </ArkDatePicker.ViewControl>

                    <ArkDatePicker.Table>
                      <ArkDatePicker.TableHead>
                        <ArkDatePicker.TableRow>
                          {api.weekDays.map((day, i) => (
                            <ArkDatePicker.TableHeader
                              key={i}
                              className="size-9 text-xs font-medium text-ink-faint"
                            >
                              {day.narrow}
                            </ArkDatePicker.TableHeader>
                          ))}
                        </ArkDatePicker.TableRow>
                      </ArkDatePicker.TableHead>
                      <ArkDatePicker.TableBody>
                        {api.weeks.map((week, i) => (
                          <ArkDatePicker.TableRow key={i}>
                            {week.map((day, j) => (
                              <ArkDatePicker.TableCell key={j} value={day}>
                                <ArkDatePicker.TableCellTrigger className={CELL}>
                                  {day.day}
                                </ArkDatePicker.TableCellTrigger>
                              </ArkDatePicker.TableCell>
                            ))}
                          </ArkDatePicker.TableRow>
                        ))}
                      </ArkDatePicker.TableBody>
                    </ArkDatePicker.Table>
                  </>
                )}
              </ArkDatePicker.Context>
            </ArkDatePicker.View>

            {/* Month and year views: the reason this exists rather than a bare
                calendar. A registration date is often years back, and paging
                month by month to reach it is the native picker at its worst. */}
            <ArkDatePicker.View view="month">
              <ArkDatePicker.Context>
                {(api) => (
                  <>
                    <ArkDatePicker.ViewControl className="mb-2 flex items-center justify-between gap-2">
                      <ArkDatePicker.PrevTrigger aria-label="Previous year" className={NAV}>
                        <ChevronLeft aria-hidden className="size-4" />
                      </ArkDatePicker.PrevTrigger>
                      <ArkDatePicker.ViewTrigger className={VIEW_TRIGGER}>
                        <ArkDatePicker.RangeText />
                      </ArkDatePicker.ViewTrigger>
                      <ArkDatePicker.NextTrigger aria-label="Next year" className={NAV}>
                        <ChevronRight aria-hidden className="size-4" />
                      </ArkDatePicker.NextTrigger>
                    </ArkDatePicker.ViewControl>
                    <ArkDatePicker.Table>
                      <ArkDatePicker.TableBody>
                        {api.getMonthsGrid({ columns: 4, format: 'short' }).map((months, i) => (
                          <ArkDatePicker.TableRow key={i}>
                            {months.map((month, j) => (
                              <ArkDatePicker.TableCell key={j} value={month.value}>
                                <ArkDatePicker.TableCellTrigger className={cn(CELL, 'w-16')}>
                                  {month.label}
                                </ArkDatePicker.TableCellTrigger>
                              </ArkDatePicker.TableCell>
                            ))}
                          </ArkDatePicker.TableRow>
                        ))}
                      </ArkDatePicker.TableBody>
                    </ArkDatePicker.Table>
                  </>
                )}
              </ArkDatePicker.Context>
            </ArkDatePicker.View>

            <ArkDatePicker.View view="year">
              <ArkDatePicker.Context>
                {(api) => (
                  <>
                    <ArkDatePicker.ViewControl className="mb-2 flex items-center justify-between gap-2">
                      <ArkDatePicker.PrevTrigger aria-label="Previous years" className={NAV}>
                        <ChevronLeft aria-hidden className="size-4" />
                      </ArkDatePicker.PrevTrigger>
                      <ArkDatePicker.ViewTrigger className={VIEW_TRIGGER}>
                        <ArkDatePicker.RangeText />
                      </ArkDatePicker.ViewTrigger>
                      <ArkDatePicker.NextTrigger aria-label="Next years" className={NAV}>
                        <ChevronRight aria-hidden className="size-4" />
                      </ArkDatePicker.NextTrigger>
                    </ArkDatePicker.ViewControl>
                    <ArkDatePicker.Table>
                      <ArkDatePicker.TableBody>
                        {api.getYearsGrid({ columns: 4 }).map((years, i) => (
                          <ArkDatePicker.TableRow key={i}>
                            {years.map((year, j) => (
                              <ArkDatePicker.TableCell key={j} value={year.value}>
                                <ArkDatePicker.TableCellTrigger className={cn(CELL, 'w-16')}>
                                  {year.label}
                                </ArkDatePicker.TableCellTrigger>
                              </ArkDatePicker.TableCell>
                            ))}
                          </ArkDatePicker.TableRow>
                        ))}
                      </ArkDatePicker.TableBody>
                    </ArkDatePicker.Table>
                  </>
                )}
              </ArkDatePicker.Context>
            </ArkDatePicker.View>
          </ArkDatePicker.Content>
        </ArkDatePicker.Positioner>
      </Portal>
    </ArkDatePicker.Root>
  )
}
