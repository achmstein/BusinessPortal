import type { MeResponse } from '@/api/generated'

/**
 * Where a signed-in person belongs when they haven't asked for anywhere in
 * particular: the front door at `/`, and the destination after sign-in.
 *
 * One rule in one place. This was previously inlined in LoginPage only, so `/`
 * had no answer at all and fell through to the catch-all — the site's own root
 * told visitors there was no page at this address.
 */
export function landingPath(user: Pick<MeResponse, 'isAdmin'> | null | undefined): string {
  if (!user) return '/login'
  return user.isAdmin ? '/admin' : '/'
}
