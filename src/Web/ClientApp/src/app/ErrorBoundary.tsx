import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/ui'

// The app previously had no boundary at all: one render-time throw anywhere
// white-screened the whole portal with nothing in the UI to explain it.

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the portal UI', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="font-display text-3xl font-medium text-ink">This page stopped working</h1>
          <p className="text-sm text-ink-faint">
            Nothing you did caused this and nothing has been lost. Reloading usually clears it — if it keeps
            happening, send us a message and we’ll look into it.
          </p>
          <div className="mt-1 flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload the page</Button>
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-4 max-w-full overflow-x-auto rounded-sm bg-surface-sunken p-3 text-left text-xs text-ink-muted">
              {error.stack ?? error.message}
            </pre>
          ) : null}
        </div>
      </main>
    )
  }
}
