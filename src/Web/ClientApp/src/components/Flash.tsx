// Ported verbatim from the original components/flash.tsx — the app's universal
// success/error banner, driven by ?ok= / ?err= query params.
export function Flash({ ok, err }: { ok?: string | null; err?: string | null }) {
  if (!ok && !err) return null
  if (err) {
    return (
      <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5">
        {err}
      </div>
    )
  }
  return (
    <div className="mb-4 rounded-lg bg-accent-50 border border-accent-200 text-accent-800 text-sm px-4 py-2.5">
      {ok}
    </div>
  )
}
