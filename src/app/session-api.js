import { submitAuthRequest, validateTokenResult } from "./auth-api.js";
import { clearAuthSession, getAuthSession, saveAuthSession } from "./auth-session.js";

export const SESSION_REFRESH_MARGIN_MS = 60000;
let refreshRequest = null;
let loggingOut = false;

function sessionError() {
  const error = new Error("Sua sessão expirou. Faça login novamente.");
  error.status = 401;
  return error;
}

export async function ensureAuthSession() {
  const session = getAuthSession();
  if (!session || loggingOut) throw sessionError();
  if (session.expiresAt - Date.now() > SESSION_REFRESH_MARGIN_MS) return session;
  return refreshAuthSession();
}

export async function refreshAuthSession() {
  const session = getAuthSession();
  if (!session || loggingOut) throw sessionError();
  if (refreshRequest?.sessionId === session.sessionId && refreshRequest.token === session.accessToken) return refreshRequest.promise;

  const request = { token: session.accessToken, sessionId: session.sessionId };
  request.promise = (async () => {
    try {
      const result = validateTokenResult(await submitAuthRequest("refresh", undefined, { accessToken: session.accessToken }));
      // Não deixa uma resposta atrasada restaurar logout ou trocar outra conta.
      const current = getAuthSession();
      if (current?.sessionId !== session.sessionId || current.accessToken !== session.accessToken) throw sessionError();
      return saveAuthSession({ authResult: result, sessionId: session.sessionId });
    } catch (error) {
      if (error.status === 401 && getAuthSession()?.sessionId === session.sessionId && getAuthSession()?.accessToken === session.accessToken) clearAuthSession();
      throw error;
    }
  })();
  refreshRequest = request;
  try {
    return await request.promise;
  } finally {
    if (refreshRequest === request) refreshRequest = null;
  }
}

export function waitForSessionRefresh(sessionId) {
  return refreshRequest?.sessionId === sessionId ? refreshRequest.promise : null;
}

export async function logoutAuthSession() {
  let session = getAuthSession();
  loggingOut = true;
  try {
    // Se o servidor já estiver trocando o JWT, revoga o token mais recente.
    if (session && refreshRequest?.sessionId === session.sessionId && refreshRequest.token === session.accessToken) {
      try { await refreshRequest.promise; } catch { /* A saída local continua. */ }
      session = getAuthSession() ?? session;
    }
    clearAuthSession();
    if (session) {
      try {
        await submitAuthRequest("logout", undefined, { accessToken: session.accessToken });
      } catch (error) {
        if (error.status !== 401) throw error;
      }
    }
  } finally {
    loggingOut = false;
  }
}
