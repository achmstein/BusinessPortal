// Single typed fetch wrapper. Cookie auth -> credentials:'include'. Reads
// ProblemDetails (detail/title) for error messages.
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.detail || body.title || body.error || message
    } catch {
      /* no JSON body */
    }
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export interface Me {
  id: string
  email: string
  isAdmin: boolean
  atoConnected: boolean
  firstName: string
  lastName: string
}

export interface BusinessEntity {
  id: string
  name: string
  entityType: string
  abn: string
  acn: string
  industry: string
  employees: number
  phone: string
  website: string
  legalName?: string
  tfn?: string
  source: string
  created: string
}

export const api = {
  me: () => apiFetch<Me>('/api/me'),
  login: (email: string, password: string) =>
    apiFetch<void>('/api/login?useCookies=true', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch<void>('/api/logout', { method: 'POST' }),
  businessEntities: () => apiFetch<BusinessEntity[]>('/api/business-entities'),
}
