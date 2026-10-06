import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  getAtoStatusOptions,
  getAtoStatusQueryKey,
  syncAtoBusinessesMutation,
  unlinkAtoMutation,
} from '@/api/generated/@tanstack/react-query.gen'
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Page,
  PageSkeleton,
  Panel,
  PanelTitle,
  TextLink,
  toastError,
  toastSuccess,
} from '@/ui'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// The ATO connection's status page. Its job is to say whether we can reach the
// ATO on your behalf, and to let you start or undo that.
//
// What changed and why:
//
//  · The status indicator no longer animates. It was an `animate-pulse` dot
//    inside an `animate-ping` halo, running forever with no reduced-motion
//    guard — motion implies something is happening, and nothing is: this is a
//    stored fact. On "Needs connecting" it was a permanently blinking alarm.
//  · The two prerequisite checkboxes are gone. They asked you to attest to
//    things we cannot verify (myID installed, RAM configured) and gated the
//    button on your own answer, which stops nobody and teaches people to tick
//    boxes. The same information now introduces the flow it actually applies
//    to, on the link page itself.
//  · "Mark as connected (manual)" is gone from the customer's view. It set the
//    connected flag without an ATO session, so the portal would claim to be
//    connected while every sync failed — a state a customer could put
//    themselves into with one click and no way to diagnose.
//  · The inverted navy help card became a line of text. A whole dark panel to
//    say "message us" outweighed what it was saying.
// ─────────────────────────────────────────────────────────────────────────────

export function AtoPortalPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const status = useQuery(getAtoStatusOptions())
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: getAtoStatusQueryKey() })

  const unlink = useMutation({
    ...unlinkAtoMutation(),
    onSuccess: async () => {
      await refreshStatus()
      setConfirmUnlink(false)
      toastSuccess('Disconnected from the ATO')
    },
    onError: () => toastError('We couldn’t disconnect', 'Try again in a moment.'),
  })

  const sync = useMutation({
    ...syncAtoBusinessesMutation(),
    onSuccess: async (data) => {
      // An expired session isn't an error — it just means linking again.
      if (data?.needsRelink) {
        navigate('/ato-portal/link')
        return
      }
      if (!data?.ok) {
        toastError('Nothing came back from the ATO', data?.reason ?? undefined)
        return
      }
      await refreshStatus()
      const count = Number(data.syncedCount) || 0
      toastSuccess(
        count === 1 ? 'Synced 1 business' : `Synced ${count} businesses`,
        'Your business details are up to date.',
      )
    },
    onError: () => toastError('The sync didn’t finish', 'Try again, or message us if it keeps happening.'),
  })

  const header = {
    title: 'ATO connection',
    description:
      'Connecting lets us read your tax registrations and prefill information from the ATO on your behalf. It’s optional — your business names work either way.',
  }

  if (status.isPending) {
    return (
      <Page {...header}>
        <PageSkeleton />
      </Page>
    )
  }

  if (status.isError) {
    return (
      <Page {...header}>
        <ErrorState
          description="We couldn’t check your ATO connection just now."
          action={
            <Button variant="secondary" onClick={() => void status.refetch()}>
              Try again
            </Button>
          }
        />
      </Page>
    )
  }

  const connected = status.data?.connected ?? false

  return (
    <Page {...header}>

      <Panel className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-[0.12em] text-ink-faint uppercase">Status</span>
            <p className="font-display text-xl leading-tight font-medium text-ink">
              {connected ? 'Connected to the ATO' : 'Not connected'}
            </p>
            <p className="max-w-prose text-sm text-ink-faint">
              {connected
                ? 'We can retrieve your details from Online services for Business.'
                : 'You approve the connection in the myID app on your phone. It takes about a minute.'}
            </p>
          </div>

          {connected ? (
            <Button variant="secondary" onClick={() => setConfirmUnlink(true)}>
              Disconnect
            </Button>
          ) : (
            <Button asChild>
              <Link to="/ato-portal/link">Connect to the ATO</Link>
            </Button>
          )}
        </div>
      </Panel>

      {connected ? (
        <Panel className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <PanelTitle as="h2">
              Update your business details from the ATO
            </PanelTitle>
            <p className="max-w-prose text-sm text-ink-faint">
              Pulls the registered name, ABN, ACN, tax accounts and{' '}
              <strong className="font-medium text-ink">tax file number</strong> for each of your businesses
              into{' '}
              <TextLink to="/business">Business</TextLink>
              . This runs automatically when you connect — use this to pull it again later.
            </p>
            <p className="text-sm text-ink-faint">
              Adding a business we don’t know about yet? Add its ABN under Business first, then sync.
            </p>
          </div>
          <Button onClick={() => sync.mutate({})} loading={sync.isPending} className="self-start">
            Sync now
          </Button>
        </Panel>
      ) : null}

      <p className="text-sm text-ink-faint">
        Stuck at any step?{' '}
        <TextLink to="/messages">Message us</TextLink>{' '}
        and we’ll walk you through it.
      </p>

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Disconnect from the ATO?"
        description="We’ll stop retrieving your tax details. Business details we’ve already synced stay where they are, and you can connect again whenever you like."
        confirmLabel="Disconnect"
        loading={unlink.isPending}
        onConfirm={() => unlink.mutate({})}
      />
    </Page>
  )
}
