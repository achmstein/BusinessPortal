import { QueryClient } from '@tanstack/react-query'

/**
 * Shared query client.
 *
 * Replaces the useState + useEffect + manual-refetch pattern that ran in 19
 * files. Beyond the caching, this fixes two structural problems: those fetch
 * sites swallowed their errors into empty arrays (so a 500 rendered as "no
 * business names yet"), and none of them could tell loading from empty.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Renewal dates change rarely; a minute of freshness avoids refetching
      // the same records on every navigation between portal screens.
      staleTime: 60_000,
      // This is a customer portal people leave open in a tab — picking up
      // server-side changes on return is worth the request.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry the client's own mistakes (401/403/404); do retry the
        // transient ones, twice.
        const status = (error as { status?: number } | null)?.status
        if (typeof status === 'number' && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
