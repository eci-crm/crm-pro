import { useCrmStore } from '@/lib/store'

/**
 * API fetch wrapper that automatically includes authentication headers
 * from the CRM user store. This is required because the middleware
 * checks for the x-crm-auth header on all non-public API routes.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const userJson = typeof window !== 'undefined'
    ? localStorage.getItem('crm_user')
    : null

  const headers = new Headers(options.headers)

  // Add auth header if user is logged in
  if (userJson) {
    try {
      const user = JSON.parse(userJson)
      headers.set('x-crm-id', user.id || '')
      headers.set('x-crm-role', user.role || '')
      headers.set('x-crm-auth', 'true')
    } catch {
      // ignore parse errors
    }
  }

  // Set content-type if not already set and body is provided
  if (options.body && !headers.has('Content-Type')) {
    if (typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json')
    }
    // For FormData, let the browser set the content-type with boundary
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  return res.json() as Promise<T>
}

/**
 * Convenience helper for API GET requests
 */
export async function apiGet<T = unknown>(
  url: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  let finalUrl = url
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) searchParams.set(key, value)
    }
    const qs = searchParams.toString()
    if (qs) finalUrl += `?${qs}`
  }

  return apiFetch<T>(finalUrl, {
    method: 'GET',
  })
}

/**
 * Convenience helper for API POST requests with JSON body
 */
export function apiPost<T = unknown>(
  url: string,
  body?: unknown
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Convenience helper for API PUT requests with JSON body
 */
export function apiPut<T = unknown>(
  url: string,
  body?: unknown
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Convenience helper for API DELETE requests
 */
export function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url, {
    method: 'DELETE',
  })
}
