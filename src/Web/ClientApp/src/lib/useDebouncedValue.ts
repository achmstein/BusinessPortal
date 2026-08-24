import { useEffect, useState } from 'react'

/**
 * Delays a value so a search box can feed a query key directly without firing a
 * request per keystroke. Debounce and caching then compose: the key only changes
 * when the debounced term does.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
