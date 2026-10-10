import { useState } from 'react'
import { getRenewalCheckout } from '@/api/generated'
import { toastError } from '@/ui'

/**
 * "Renew" goes straight to Renewtron's checkout in a new tab — the portal stays
 * open behind it, so the customer comes back to their records when they're done.
 *
 * The tab is opened inside the click, before the checkout address arrives:
 * a window opened after an await is a popup, and browsers block those.
 */
export function useRenewCheckout() {
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function renew(businessNameId: string) {
    const tab = window.open('', '_blank')
    tab?.document.write('<p style="font-family:system-ui,sans-serif;padding:2rem">Opening secure checkout…</p>')
    setPendingId(businessNameId)
    try {
      const { data } = await getRenewalCheckout({ query: { businessNameId }, throwOnError: true })
      if (!data?.url) throw new Error('No checkout address returned.')
      if (tab) {
        tab.opener = null
        tab.location.href = data.url
      } else {
        // Popups blocked outright: same tab is better than nothing.
        window.location.assign(data.url)
      }
    } catch {
      tab?.close()
      toastError('Online renewal isn’t available right now', 'Try again shortly, or message us.')
    } finally {
      setPendingId(null)
    }
  }

  return { renew, pendingId }
}
