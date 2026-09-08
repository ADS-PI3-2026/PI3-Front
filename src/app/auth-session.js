const SESSION_STORAGE_KEY = "legado-car-session";

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function saveAuthSession({ authResult, email }) {
  if (!canUseSessionStorage()) return;

  const apiData = authResult?.data && typeof authResult.data === "object"
    ? authResult.data
    : {};
  const session = {
    accessToken: apiData.access_token ?? apiData.token ?? null,
    createdAt: new Date().toISOString(),
    email,
    mode: authResult?.mode ?? "preview",
    user: apiData.user ?? { email },
  };

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getAuthSession() {
  if (!canUseSessionStorage()) return null;

  const storedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedSession) return null;

  try {
    return JSON.parse(storedSession);
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
