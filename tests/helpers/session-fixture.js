import { saveAuthSession } from "../../src/app/auth-session.js";

export const user = { id: 100, name: "Pessoa Teste", email: "conta@example.test" };
export function token(seconds = 3600, id = "token") {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${id}.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
}
export function installStorage() {
  const stored = new Map();
  const events = new EventTarget();
  globalThis.window = {
    sessionStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) },
    dispatchEvent: events.dispatchEvent.bind(events),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return stored;
}
export function startSession(seconds = 3600) {
  return saveAuthSession({ authResult: { mode: "api", data: { access_token: token(seconds), token_type: "bearer", expires_in: seconds, user } } });
}
export function success(data = null) {
  return Response.json({ status: "success", message: "OK", data });
}
