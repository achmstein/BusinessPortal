import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

// Self-hosted so first paint isn't waiting on a third-party font host.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'

import './lib/apiClient' // configures the generated API client (side-effect)
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './app/ErrorBoundary'
import { queryClient } from './app/queryClient'
import { ToastRegion } from './ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ToastRegion />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
