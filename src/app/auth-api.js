const AUTH_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  requestEmailVerification: "/auth/email/request-verification",
  verifyEmail: "/auth/email/verify",
  requestPasswordReset: "/auth/password/request-reset",
  verifyPasswordCode: "/auth/password/verify-code",
  resetPassword: "/auth/password/reset",
};

export function buildAuthRequest(action, payload) {
  const endpoint = AUTH_ENDPOINTS[action];

  if (!endpoint) {
    throw new Error(`Ação de autenticação desconhecida: ${action}`);
  }

  return {
    endpoint,
    options: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  };
}

export async function submitAuthRequest(action, payload) {
  const request = buildAuthRequest(action, payload);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (!apiUrl) {
    return {
      ok: true,
      mode: "preview",
      endpoint: request.endpoint,
      request: request.options,
    };
  }

  const response = await fetch(`${apiUrl}${request.endpoint}`, request.options);
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error("Não foi possível concluir a solicitação.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    ok: true,
    mode: "api",
    status: response.status,
    data,
  };
}
