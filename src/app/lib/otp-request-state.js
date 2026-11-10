import { getAuthSession } from "../auth-session.js";

export const OTP_REQUEST_VALIDITY_MS = 10 * 60 * 1000;

const STORAGE_PREFIX = "legadocar:pending-otp";

function getStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function getStorageKey(purpose, resourceId = "account") {
  return `${STORAGE_PREFIX}:${purpose}:${resourceId}`;
}

export function clearPendingOtpRequest(purpose, resourceId) {
  try {
    getStorage()?.removeItem(getStorageKey(purpose, resourceId));
  } catch {
    // A interface ainda funciona normalmente quando o armazenamento está indisponível.
  }
}

export function readPendingOtpRequest(purpose, resourceId) {
  const storage = getStorage();
  if (!storage) return null;

  const key = getStorageKey(purpose, resourceId);
  try {
    const entry = JSON.parse(storage.getItem(key));
    const session = getAuthSession();
    if (!entry || entry.purpose !== purpose || entry.sessionId !== session?.sessionId
      || !Number.isFinite(entry.requestedAt) || !Number.isFinite(entry.expiresAt)
      || entry.expiresAt <= Date.now()) {
      storage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function savePendingOtpRequest(purpose, resourceId, requestedAt = Date.now()) {
  const storage = getStorage();
  const session = getAuthSession();
  if (!storage || !session?.sessionId) return null;

  const entry = {
    expiresAt: requestedAt + OTP_REQUEST_VALIDITY_MS,
    purpose,
    requestedAt,
    sessionId: session.sessionId,
  };

  try {
    storage.setItem(getStorageKey(purpose, resourceId), JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}
