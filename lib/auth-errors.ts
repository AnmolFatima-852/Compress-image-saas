export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'This email is already registered. Please sign in with new account.';

export const SIGNUP_VERIFY_EMAIL_MESSAGE = 'Check your inbox to verify your email.';

export const EMAIL_VERIFIED_SUCCESS_MESSAGE = 'Email verified successfully. Please sign in.';

/**
 * Supabase often returns a user with an empty identities array (and no session)
 * when signUp is called with an email that already exists, instead of throwing.
 */
export function isDuplicateSignupResponse(user: { identities?: unknown[] | null } | null | undefined) {
  if (!user) {
    return false;
  }

  return Array.isArray(user.identities) && user.identities.length === 0;
}

/** Maps Supabase Auth errors to user-friendly copy. */
export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirm your email before signing in. Check your inbox for the verification link.';
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('email address is already')
  ) {
    return EMAIL_ALREADY_REGISTERED_MESSAGE;
  }

  if (normalized.includes('password should be at least')) {
    return 'Password must be at least 6 characters.';
  }

  if (normalized.includes('unable to validate email address')) {
    return 'Please enter a valid email address.';
  }

  if (normalized.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (normalized.includes('signup is disabled')) {
    return 'Sign up is temporarily unavailable. Please contact support.';
  }

  return message;
}
