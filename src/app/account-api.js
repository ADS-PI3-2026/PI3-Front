import { submitApiRequest } from "./auth-api.js";
import { clearAuthSession, getAuthSession, updateAuthSessionUser } from "./auth-session.js";
import { ensureAuthSession, waitForSessionRefresh } from "./session-api.js";

export async function requestAccount(endpoint, options = {}) {
  let session = await ensureAuthSession();
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
  const result = await requestAccount("/me", { method: "GET" });
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
