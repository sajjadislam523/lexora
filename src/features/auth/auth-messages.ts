/**
 * Maps Better Auth client errors to calm, specific messages. Sign-in failures are deliberately
 * generic so the form never reveals whether an email address has an account.
 */
type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

export function signInErrorMessage(error: AuthError) {
  if (!error) return null;
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Email or password is incorrect.";
  }
  return "We couldn’t sign you in. Please try again.";
}

export function signUpErrorMessage(error: AuthError) {
  if (!error) return null;
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.code?.includes("ALREADY_EXISTS") || error.status === 422) {
    return "exists";
  }
  if (error.code?.includes("PASSWORD")) return "That password can’t be used. Try a longer one.";
  return "We couldn’t create your account. Please try again.";
}

/** The answer to a reset request is the same for every address, so only transport errors show. */
export function forgotPasswordErrorMessage(error: AuthError) {
  if (!error) return null;
  if (error.status === 429)
    return "You’ve asked for several links just now. Wait a minute, then try again.";
  return "We couldn’t send the email right now. Please try again in a few minutes.";
}

export function resetPasswordErrorMessage(error: AuthError) {
  if (!error) return null;
  if (error.code === "INVALID_TOKEN") return "invalid-link";
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.code?.includes("PASSWORD")) return "That password can’t be used. Try a longer one.";
  return "We couldn’t change your password. Please try again.";
}

export const NETWORK_ERROR = "Lexora can’t be reached. Check your connection and try again.";
