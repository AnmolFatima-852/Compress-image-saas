import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Refresh auth cookies on app pages (including `/`) so Server Actions like
 * compressImageAction can read the signed-in user when saving history.
 */
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/profile/:path*',
    '/login',
    '/signup',
    '/reset-password',
    '/auth/callback',
  ],
};
