const AUTH_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  requestEmailVerification: "/auth/pre-register",
  verifyEmail: "/auth/validate-email",
  requestPasswordReset: "/auth/forgot-password",
  verifyPasswordCode: "/auth/validate-reset-code",
  resetPassword: "/auth/reset-password",
};

const VERIFICATION_MESSAGES = {
  "The verification email has already been sent.": "O código já foi enviado. Aguarde dois minutos antes de solicitar outro.",
  "The verification code was not valid.": "O código informado é inválido. Confira os seis números recebidos por e-mail.",
  "The verification code has expired.": "O código expirou. Solicite um novo código para confirmar seu e-mail.",
  "Invalid Credentials": "E-mail ou senha incorretos. Confira os dados e tente novamente.",
};

export function getAuthFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fields = {
    name: "name",
    email: "email",
    document: "document",
    document_type: "document",
    password: "password",
    password_confirmation: "confirm",
    terms_accepted: "terms",
    code: "code",
  };
  const errors = {};

  for (const [field, messages] of Object.entries(error?.data?.errors ?? {})) {
    if (fields[field]) {
      const message = Array.isArray(messages) ? messages[0] : messages;
      if (typeof message === "string" && !errors[fields[field]]) errors[fields[field]] = message;
    }
  }

  return errors;
}

export function getAuthErrorMessage(error, fallback) {
  if (error?.status === 401 && error?.data?.message !== "Invalid Credentials") return "Sua sessão expirou. Faça login novamente.";
  if (error?.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (error?.status >= 500) {
    return "O serviço está indisponível no momento. Tente novamente mais tarde.";
  }
  if (Object.keys(getAuthFieldErrors(error)).length > 0) {
    return "Confira os campos destacados e tente novamente.";
  }
  if (error?.status === 404) return "O serviço solicitado não está disponível no momento. Tente novamente mais tarde.";

  const message = error?.data?.message;
  return VERIFICATION_MESSAGES[message]
    ?? (typeof message === "string" && message ? message : null)
    ?? error?.message ?? fallback;
}

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

export async function submitAuthRequest(action, payload, options = {}) {
  const request = buildAuthRequest(action, payload);
  return submitApiRequest(request.endpoint, { ...options, payload });
}

export async function submitApiRequest(endpoint, {
  method = "POST",
  payload,
  formData,
  accessToken,
  actionToken,
  responseType = "json",
} = {}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (!apiUrl) {
    throw new Error("Não foi possível conectar ao serviço. Tente novamente mais tarde.");
  }

  let response;
  try {
    const hasBody = !["GET", "HEAD"].includes(method);
    response = await fetch(`${apiUrl}${endpoint}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(formData === undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(actionToken ? { "X-Action-Token": actionToken } : {}),
      },
      ...(hasBody && formData !== undefined ? { body: formData } : {}),
      ...(hasBody && formData === undefined && payload !== undefined
        ? { body: JSON.stringify(payload) }
        : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (["TimeoutError", "AbortError"].includes(error?.name)) {
      throw new Error("O serviço demorou para responder. Tente novamente em alguns instantes.");
    }
    throw new Error("Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.");
  }

  if (response.ok && responseType === "blob") {
    return {
      ok: true,
      mode: "api",
      status: response.status,
      data: await response.blob(),
      message: "",
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const error = new Error("O serviço retornou uma resposta inesperada. Tente novamente mais tarde.");
    error.status = response.status;
    throw error;
  }

  let body;
  try {
    body = await response.json();
  } catch {
    const error = new Error("O serviço retornou uma resposta inesperada. Tente novamente mais tarde.");
    error.status = response.status;
    throw error;
  }

  if (!response.ok || body?.status !== "success") {
    const error = new Error("Não foi possível concluir a solicitação.");
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return {
    ok: true,
    mode: "api",
    status: response.status,
    data: body.data,
    message: body.message,
  };
}

export async function loginWithCredentials({ email, password }) {
  const result = await submitAuthRequest("login", {
    email: email.trim().toLowerCase(),
    password,
  });
  return validateTokenResult(result);
}

export function validateTokenResult(result) {
  const data = result.data;
  if (result.status !== 200
    || typeof data?.access_token !== "string" || !data.access_token.trim()
    || data.token_type !== "bearer"
    || !Number.isFinite(data.expires_in) || data.expires_in <= 0
    || !Number.isInteger(data.user?.id) || data.user.id <= 0
    || typeof data.user.email !== "string" || !data.user.email.trim()) {
    throw new Error("Não foi possível iniciar sua sessão. O serviço retornou uma resposta inesperada. Tente novamente.");
  }
  return result;
}
