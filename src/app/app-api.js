import { submitApiRequest } from "./auth-api.js";

export async function submitJsonRequest(endpoint, options = {}) {
  return submitApiRequest(endpoint.startsWith("/") ? endpoint : `/${endpoint}`, options);
}
