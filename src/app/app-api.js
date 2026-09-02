function normalizeEndpoint(endpoint) {
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

export async function submitJsonRequest(endpoint, {
  method = "POST",
  payload,
  accessToken,
} = {}) {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const options = {
    method,
    headers,
    body: JSON.stringify(payload),
  };

  if (!apiUrl) {
    return {
      ok: true,
      mode: "preview",
      endpoint: normalizedEndpoint,
      method,
      payload,
      request: options,
    };
  }

  const response = await fetch(`${apiUrl}${normalizedEndpoint}`, options);
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
