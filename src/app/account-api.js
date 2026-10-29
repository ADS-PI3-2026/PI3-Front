import { submitApiRequest } from "./auth-api.js";
import { clearAuthSession, getAuthSession, updateAuthSessionUser } from "./auth-session.js";
import { ensureAuthSession, waitForSessionRefresh } from "./session-api.js";

const readCache = new Map();
const pendingReads = new Map();
let cacheSessionId = null;
let readRevision = 0;

export function invalidateAccountReadCache() {
  readCache.clear();
  readRevision += 1;
}

export function getCachedAccountResponse(endpoint, { allowStale = false } = {}) {
  const session = getAuthSession();
  if (!session || session.sessionId !== cacheSessionId) return null;
  const entry = readCache.get(endpoint);
  if (!entry || (!allowStale && entry.expiresAt <= Date.now())) return null;
  return entry.result;
}

export async function requestAccount(endpoint, options = {}) {
  const session = await ensureAuthSession();
  if (getAuthSession()?.sessionId !== session.sessionId) {
    throw new Error("Sua sessão mudou durante a solicitação. Tente novamente.");
  }
  if (cacheSessionId !== session.sessionId) {
    cacheSessionId = session.sessionId;
    invalidateAccountReadCache();
    pendingReads.clear();
  }
  const { cacheForMs = 0, ...requestOptions } = options;
  const method = requestOptions.method ?? "POST";
  const isJsonRead = method === "GET" && !requestOptions.actionToken
    && (!requestOptions.responseType || requestOptions.responseType === "json");
  if (!isJsonRead) {
    const result = await performAccountRequest(session, endpoint, requestOptions);
    if (!["GET", "HEAD"].includes(method)) invalidateAccountReadCache();
    return result;
  }

  const cached = cacheForMs > 0 ? getCachedAccountResponse(endpoint) : null;
  if (cached) return cached;
  const revision = readRevision;
  const key = `${session.sessionId}:${revision}:${endpoint}`;
  if (pendingReads.has(key)) return pendingReads.get(key);
  const pending = performAccountRequest(session, endpoint, requestOptions).then((result) => {
    if (cacheForMs > 0 && readRevision === revision
      && getAuthSession()?.sessionId === session.sessionId) {
      readCache.set(endpoint, { expiresAt: Date.now() + cacheForMs, result });
    }
    return result;
  });
  pendingReads.set(key, pending);
  try {
    return await pending;
  } finally {
    if (pendingReads.get(key) === pending) pendingReads.delete(key);
  }
}

async function performAccountRequest(initialSession, endpoint, options) {
  let session = initialSession;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await submitApiRequest(endpoint, { ...options, accessToken: session.accessToken });
      if (getAuthSession()?.sessionId !== session.sessionId) {
        throw new Error("Sua sessão mudou durante a solicitação. Tente novamente.");
      }
      return { ...result, sessionId: session.sessionId };
    } catch (error) {
      if (attempt === 0 && error.status === 401) {
        // O servidor pode ter invalidado o JWT antes de entregar o novo ao navegador.
        try { await waitForSessionRefresh(session.sessionId); }
        catch { /* A falha de autenticação original continua sendo tratada abaixo. */ }
      }
      const current = getAuthSession();
      // O middleware recusou o JWT anterior; a operação ainda não foi executada.
      if (attempt === 0 && error.status === 401 && current?.sessionId === session.sessionId
        && current.accessToken !== session.accessToken) {
        session = current;
        continue;
      }
      if (error.status === 401 && current?.sessionId === session.sessionId && current.accessToken === session.accessToken) clearAuthSession();
      throw error;
    }
  }
}

export async function getCurrentUser() {
  const result = await requestAccount("/me", { method: "GET", cache: "no-store" });
  const user = result.data;
  if (!Number.isInteger(user?.id) || user.id <= 0 || typeof user.name !== "string"
    || typeof user.email !== "string" || !user.email) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar seu perfil. Tente novamente.");
  }
  updateAuthSessionUser(user, result.sessionId);
  return user;
}

export async function requestAccountDeletionCode() {
  return requestAccount("/otp/request", { payload: { purpose: "account_deletion" } });
}

export async function validateAccountDeletionCode(code) {
  if (!/^\d{6}$/.test(code)) throw new Error("Digite os seis números enviados para o seu e-mail.");
  const result = await requestAccount("/otp/validate", { payload: { purpose: "account_deletion", code } });
  if (typeof result.data?.action_token !== "string" || !result.data.action_token.trim()) {
    throw new Error("Não foi possível confirmar sua identidade. Solicite um novo código.");
  }
  return result.data.action_token;
}

export async function deleteAccount(actionToken) {
  if (typeof actionToken !== "string" || !actionToken.trim()) {
    throw new Error("Solicite um novo código de confirmação antes de excluir sua conta.");
  }
  const result = await requestAccount("/me", { method: "DELETE", actionToken });
  clearAuthSession();
  return result;
}
