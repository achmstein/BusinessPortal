import { PageHeader } from '../components/PageHeader'

// On-theme stand-in for pages not yet ported from the original app.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="This section is being ported from the original app." />
      <div className="card-pad text-sm text-navy-500">Coming soon in the .NET port.</div>
    </>
  )
}
