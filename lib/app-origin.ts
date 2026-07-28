/**
 * Resolves the public app origin for auth redirects.
 * In development, always uses the incoming request origin so redirects match the running dev port.
 */
export function resolveAppOrigin(requestUrl: string): string {
  const fromRequest = new URL(requestUrl).origin;

  if (process.env.NODE_ENV === 'development') {
    return fromRequest;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    return fromRequest;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return fromRequest;
  }
}
