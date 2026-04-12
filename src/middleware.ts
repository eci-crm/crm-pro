import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Authentication is handled client-side via Zustand store + localStorage.
  // All API routes are allowed through — individual routes handle auth internally if needed.
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
