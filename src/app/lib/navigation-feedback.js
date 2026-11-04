const FEEDBACK_KEY = "legadocar:navigation-feedback";
const FEEDBACK_LIFETIME_MS = 60 * 1000;

function getStorage(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function saveNavigationFeedback(message, storage) {
  const normalizedMessage = String(message ?? "").trim();
  if (!normalizedMessage) return false;
  const targetStorage = getStorage(storage);
  if (!targetStorage) return false;

  try {
    targetStorage.setItem(FEEDBACK_KEY, JSON.stringify({
      expiresAt: Date.now() + FEEDBACK_LIFETIME_MS,
      message: normalizedMessage,
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeNavigationFeedback(storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return "";

  try {
    const raw = targetStorage.getItem(FEEDBACK_KEY);
    targetStorage.removeItem(FEEDBACK_KEY);
    if (!raw) return "";

    const feedback = JSON.parse(raw);
    if (Number(feedback?.expiresAt) < Date.now()) return "";
    return typeof feedback?.message === "string" ? feedback.message.trim() : "";
  } catch {
    targetStorage.removeItem(FEEDBACK_KEY);
    return "";
  }
}
