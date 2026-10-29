import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearAuthSession, getAuthSession } from "../src/app/auth-session.js";
import { getCurrentUser } from "../src/app/account-api.js";
import { installStorage, startSession, success, user } from "./helpers/session-fixture.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
let unsubscribe;
beforeEach(() => { installStorage(); startSession(); process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api"; });
afterEach(() => {
  unsubscribe?.(); unsubscribe = null;
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
const store = () => import("../src/app/session-store.js");

test("ler o estado compartilhado da sessão não executa GET /me", async () => {
  globalThis.fetch = () => assert.fail("Navegação com usuário na sessão não deve consultar /me.");
  const { getSessionSnapshot } = await store();
  const garage = getSessionSnapshot();
  const profile = getSessionSnapshot();
  assert.equal(garage.ready, true);
  assert.equal(profile.session.user.id, user.id);
  assert.equal(profile, garage);
});

test("encerrar a sessão remove imediatamente o usuário compartilhado", async () => {
  const { getSessionSnapshot, subscribeToSession } = await store();
  getSessionSnapshot();
  let updates = 0;
  unsubscribe = subscribeToSession(() => updates++);
  clearAuthSession();
  assert.equal(getSessionSnapshot().session, null);
  assert.equal(updates, 1);
});

test("atualizar o perfil explicitamente notifica a sessão sem disparar outra consulta", async () => {
  const { getSessionSnapshot, subscribeToSession } = await store();
  let updates = 0;
  let calls = 0;
  unsubscribe = subscribeToSession(() => updates++);
  globalThis.fetch = async () => { calls++; return success({ ...user, name: "Nome atualizado" }); };
  await getCurrentUser();
  assert.equal(getSessionSnapshot().session.user.name, "Nome atualizado");
  assert.equal(updates, 1);
  assert.equal(calls, 1);
});

test("SSR usa snapshot estável sem acesso aos dados de outra sessão", async () => {
  const { getServerSessionSnapshot } = await store();
  assert.equal(getServerSessionSnapshot().ready, false);
  assert.equal(getServerSessionSnapshot().session, null);
  assert.equal(getServerSessionSnapshot(), getServerSessionSnapshot());
});

test("monitor verifica a sessão válida sem solicitar os dados do usuário", async () => {
  const { startSessionMonitor, getSessionSnapshot } = await store();
  globalThis.fetch = () => assert.fail("Monitor não deveria chamar /me nem refresh antes da hora.");
  unsubscribe = startSessionMonitor();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getSessionSnapshot().session.accessToken, getAuthSession().accessToken);
});
