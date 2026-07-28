import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_POST_AUTH_PATH } from '@/lib/auth';
import { resolveAppOrigin } from '@/lib/app-origin';

function clearSupabaseCookies(response: NextResponse, request: NextRequest) {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-') || name.includes('supabase') || name.includes('auth-token')) {
      response.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });
}

async function signOutAndRedirect(request: NextRequest) {
  const origin = resolveAppOrigin(request.url);
  const response = NextResponse.redirect(new URL(DEFAULT_POST_AUTH_PATH, origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    clearSupabaseCookies(response, request);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.signOut({ scope: 'global' });
  clearSupabaseCookies(response, request);

  return response;
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}
