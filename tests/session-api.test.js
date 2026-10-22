import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearAuthSession, getAuthSession } from "../src/app/auth-session.js";
import { installStorage, startSession, success, token, user } from "./helpers/session-fixture.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
beforeEach(() => { installStorage(); process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});

async function api() { return import("../src/app/session-api.js"); }

test("uma sessão com tempo restante suficiente não gera refresh", async () => {
  const session = startSession();
  globalThis.fetch = () => assert.fail("Não deveria renovar ainda.");
  assert.equal((await (await api()).ensureAuthSession()).accessToken, session.accessToken);
});

test("requisições concorrentes compartilham o refresh e salvam o novo JWT", async () => {
  const session = startSession(30);
  const refreshedToken = token(3600, "renovado");
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "http://localhost:8000/api/auth/refresh");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return success({ access_token: refreshedToken, token_type: "bearer", expires_in: 3600, user });
  };
  const { ensureAuthSession } = await api();
  const sessions = await Promise.all([ensureAuthSession(), ensureAuthSession(), ensureAuthSession()]);
  assert.equal(calls, 1);
  assert.ok(sessions.every((value) => value.accessToken === refreshedToken));
  assert.equal(getAuthSession().accessToken, refreshedToken);
});

test("401 no refresh encerra a sessão", async () => {
  startSession(30);
  globalThis.fetch = async () => Response.json({ message: "Unauthenticated." }, { status: 401 });
  await assert.rejects((await api()).ensureAuthSession(), (error) => error.status === 401);
  assert.equal(getAuthSession(), null);
});

test("falha de conexão no refresh preserva a sessão que ainda não expirou", async () => {
  const session = startSession(30);
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects((await api()).ensureAuthSession(), /conexão/);
  assert.equal(getAuthSession().accessToken, session.accessToken);
});

test("refresh atrasado não restaura uma sessão encerrada pelo usuário", async () => {
  startSession(30);
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const { ensureAuthSession } = await api();
  const request = ensureAuthSession();
  await new Promise((resolve) => setImmediate(resolve));
  clearAuthSession();
  finish(success({ access_token: token(3600, "atrasado"), token_type: "bearer", expires_in: 3600, user }));
  await assert.rejects(request, /sessão/i);
  assert.equal(getAuthSession(), null);
});

test("logout revoga o token no servidor e apaga a sessão local", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/auth/logout");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    return success();
  };
  await (await api()).logoutAuthSession();
  assert.equal(getAuthSession(), null);
});

test("logout sem conexão ainda encerra o acesso local e sinaliza falha de revogação", async () => {
  startSession();
  globalThis.fetch = async () => { throw new TypeError("Offline"); };
  await assert.rejects((await api()).logoutAuthSession(), /conexão/);
  assert.equal(getAuthSession(), null);
});

test("logout durante refresh revoga o JWT novo e não deixa sessão ativa", async () => {
  startSession(30);
  const newToken = token(3600, "refresh-em-andamento");
  let finish;
  let revoked;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/refresh")) return new Promise((resolve) => { finish = resolve; });
    revoked = options.headers.Authorization;
    return success();
  };
  const { ensureAuthSession, logoutAuthSession } = await api();
  const refreshing = ensureAuthSession();
  await new Promise((resolve) => setImmediate(resolve));
  const logout = logoutAuthSession();
  finish(success({ access_token: newToken, token_type: "bearer", expires_in: 3600, user }));
  await Promise.all([refreshing, logout]);
  assert.equal(revoked, `Bearer ${newToken}`);
  assert.equal(getAuthSession(), null);
});

test("refresh pendente não substitui uma nova sessão mesmo se o JWT anterior for igual", async () => {
  startSession(30);
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const { ensureAuthSession } = await api();
  const request = ensureAuthSession();
  await new Promise((resolve) => setImmediate(resolve));
  const next = startSession(30);
  finish(success({ access_token: token(3600, "resposta-antiga"), token_type: "bearer", expires_in: 3600, user }));
  await assert.rejects(request, /sessão/i);
  assert.equal(getAuthSession().sessionId, next.sessionId);
});
