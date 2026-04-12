import { NextRequest, NextResponse } from 'next/server'

// API routes that don't require authentication (public)
const PUBLIC_API_ROUTES = ['/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public auth routes
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // For all other API routes, check for the crm_user cookie/localStorage marker
  // Since this is a client-side auth (no server sessions), we use a header-based check
  // The client sends an Authorization header with the user token from Zustand store
  const authHeader = request.headers.get('x-crm-auth')

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
