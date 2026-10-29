import { AUTH_SESSION_EVENT, getAuthSession } from "./auth-session.js";
import { getAuthErrorMessage } from "./auth-api.js";
import { ensureAuthSession } from "./session-api.js";

const serverSnapshot = { ready: false, session: null, warning: "" };
let clientSnapshot = serverSnapshot;
let snapshotKey = "";
let sessionWarning = null;
let currentMonitor = null;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

export function getServerSessionSnapshot() {
  return serverSnapshot;
}

export function getSessionSnapshot() {
  if (typeof window === "undefined") return serverSnapshot;
  const session = getAuthSession();
  const warning = session && sessionWarning?.sessionId === session.sessionId ? sessionWarning.message : "";
  const key = JSON.stringify({ session, warning });
  // useSyncExternalStore exige a mesma referência enquanto os dados não mudam.
  if (key !== snapshotKey || !clientSnapshot.ready) {
    snapshotKey = key;
    clientSnapshot = { ready: true, session, warning };
  }
  return clientSnapshot;
}

export function subscribeToSession(listener) {
  const browser = window;
  listeners.add(listener);
  browser.addEventListener(AUTH_SESSION_EVENT, listener);
  browser.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    browser.removeEventListener(AUTH_SESSION_EVENT, listener);
    browser.removeEventListener("storage", listener);
  };
}

export function recheckSession() {
  return currentMonitor?.();
}

export function startSessionMonitor() {
  let stopped = false;
  let checking = false;
  let timer;
  const check = async () => {
    if (stopped || checking) return;
    clearTimeout(timer);
    const session = getAuthSession();
    if (!session) {
      sessionWarning = null;
      notify();
      return;
    }
    checking = true;
    try {
      await ensureAuthSession();
      if (!stopped) sessionWarning = null;
    } catch (error) {
      const current = getAuthSession();
      if (!stopped && current?.sessionId === session.sessionId && error.status !== 401) {
        sessionWarning = { sessionId: session.sessionId,
          message: getAuthErrorMessage(error, "Não foi possível atualizar sua sessão. Tente novamente.") };
      }
    } finally {
      checking = false;
      if (!stopped) {
        notify();
        const current = getAuthSession();
        if (current) timer = setTimeout(check, Math.min(30000, current.expiresAt - Date.now() + 50));
      }
    }
  };
  const onSessionChange = () => { if (!checking) queueMicrotask(check); };
  const onVisible = () => { if (!document.hidden) void check(); };
  window.addEventListener(AUTH_SESSION_EVENT, onSessionChange);
  window.addEventListener("focus", check);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  currentMonitor = check;
  queueMicrotask(check);
  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener(AUTH_SESSION_EVENT, onSessionChange);
    window.removeEventListener("focus", check);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    if (currentMonitor === check) currentMonitor = null;
  };
}
