// Mesmo prazo de confirmação aplicado por VerificationEmailService::isVerified.
const CONFIRMATION_VALIDITY_MS = 10 * 60 * 1000;

export function getRecoveryStep(request, now) {
  if (!request.email) return "email";
  if (request.verifiedAt && now - request.verifiedAt < CONFIRMATION_VALIDITY_MS) return "password";
  if (request.sentAt && now - request.sentAt < CONFIRMATION_VALIDITY_MS) return "code";
  return "email";
}
