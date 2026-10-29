export const AUTH_SESSION_EVENT = "legado-car-session-changed";

const SESSION_STORAGE_KEY = "legado-car-session";

function getSessionStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isValidUser(user) {
  return Number.isInteger(user?.id) && user.id > 0
    && typeof user.email === "string" && Boolean(user.email.trim());
}

// A leitura de exp serve apenas para controlar a interface. A API valida o JWT.
function getTokenExpiration(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload));
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveAuthSession({ authResult, sessionId }) {
  const data = authResult?.data;
  const now = Date.now();
  if (authResult?.mode !== "api" || typeof data?.access_token !== "string"
    || !data.access_token.trim() || !isValidUser(data.user)) {
    throw new Error("Não foi possível iniciar sua sessão. Tente entrar novamente.");
  }

  const tokenExpiration = getTokenExpiration(data.access_token);
  const responseExpiration = Number.isFinite(data.expires_in) && data.expires_in > 0
    ? now + data.expires_in * 1000 : null;
  const expirations = [tokenExpiration, responseExpiration].filter(Number.isFinite);
  const expiresAt = expirations.length ? Math.min(...expirations) : null;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }

  const session = {
    sessionId: sessionId ?? globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`,
    accessToken: data.access_token,
    tokenType: "bearer",
    createdAt: new Date(now).toISOString(),
    expiresAt,
    email: data.user.email,
    mode: "api",
    user: data.user,
  };
  try {
    const storage = getSessionStorage();
    if (!storage) throw new Error("Armazenamento indisponível.");
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    throw new Error("Não foi possível salvar sua sessão neste navegador. Permita o armazenamento do site e tente novamente.");
  }
  window.dispatchEvent?.(new Event(AUTH_SESSION_EVENT));
  return session;
}

export function getAuthSession() {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored);
    const tokenExpiration = typeof session?.accessToken === "string"
      ? getTokenExpiration(session.accessToken) : null;
    // Mantém sessões reais anteriores que ainda tenham um JWT dentro da validade.
    const expirations = [session?.expiresAt, tokenExpiration].filter(Number.isFinite);
    const expiresAt = expirations.length ? Math.min(...expirations) : null;
    if (session?.mode !== "api" || typeof session.accessToken !== "string"
      || !session.accessToken.trim() || !isValidUser(session.user)
      || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return { ...session, sessionId: session.sessionId ?? session.createdAt ?? session.accessToken, expiresAt, tokenType: "bearer" };
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  try {
    getSessionStorage()?.removeItem(SESSION_STORAGE_KEY);
    if (typeof window !== "undefined") window.dispatchEvent?.(new Event(AUTH_SESSION_EVENT));
  } catch {
    // O navegador pode bloquear o armazenamento; a leitura já recusa a sessão.
  }
}

export function updateAuthSessionUser(user, expectedSessionId) {
  const session = getAuthSession();
  if (!session || session.sessionId !== expectedSessionId || !isValidUser(user)) return;
  const next = { ...session, email: user.email, user };
  getSessionStorage().setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent?.(new Event(AUTH_SESSION_EVENT));
  return next;
}
