import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { getAuthSession } from "../src/app/auth-session.js";
import { installStorage, startSession, success, user } from "./helpers/session-fixture.js";
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
beforeEach(() => { installStorage(); process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
async function api() { return import("../src/app/account-api.js"); }

test("perfil consulta /me com Bearer e não envia corpo em GET", async () => {
  const session = startSession();
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestOptions = options;
    assert.equal(url, "http://localhost:8000/api/me");
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    return success({ ...user, name: "Nome atualizado" });
  };
  assert.equal((await (await api()).getCurrentUser()).name, "Nome atualizado");
  assert.equal(requestOptions.cache, "no-store");
  assert.equal(getAuthSession().user.name, "Nome atualizado");
});

test("perfil recusa resposta sem usuário válido", async () => {
  startSession();
  globalThis.fetch = async () => success(null);
  await assert.rejects((await api()).getCurrentUser(), /resposta inesperada/);
});

test("401 em rota protegida remove a sessão e não simula sucesso", async () => {
  startSession();
  globalThis.fetch = async () => Response.json({ message: "Unauthenticated." }, { status: 401 });
  await assert.rejects((await api()).getCurrentUser(), (error) => error.status === 401);
  assert.equal(getAuthSession(), null);
});

test("exclusão solicita e valida OTP no propósito correto, depois usa X-Action-Token", async () => {
  startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return success(url.endsWith("/validate") ? { action_token: "autorizacao-de-uso-unico" } : null);
  };
  const { requestAccountDeletionCode, validateAccountDeletionCode, deleteAccount } = await api();
  await requestAccountDeletionCode();
  const actionToken = await validateAccountDeletionCode("123456");
  await deleteAccount(actionToken);
  assert.deepEqual(requests.map(({ url }) => url), [
    "http://localhost:8000/api/otp/request", "http://localhost:8000/api/otp/validate", "http://localhost:8000/api/me",
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), { purpose: "account_deletion" });
  assert.deepEqual(JSON.parse(requests[1].options.body), { purpose: "account_deletion", code: "123456" });
  assert.equal(requests[2].options.method, "DELETE");
  assert.equal(requests[2].options.headers["X-Action-Token"], "autorizacao-de-uso-unico");
  assert.equal(getAuthSession(), null);
});

test("exclusão não avança sem action_token real nem sem seis dígitos", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success(null); };
  const { validateAccountDeletionCode, deleteAccount } = await api();
  await assert.rejects(validateAccountDeletionCode("12x456"), /seis números/);
  await assert.rejects(deleteAccount(""), /confirmação/);
  assert.equal(calls, 0);
  await assert.rejects(validateAccountDeletionCode("123456"), /confirmar/);
});

test("resposta atrasada de /me não mistura dados de outra sessão", async () => {
  startSession();
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const request = (await api()).getCurrentUser();
  await new Promise((resolve) => setImmediate(resolve));
  const { saveAuthSession } = await import("../src/app/auth-session.js");
  const { token } = await import("./helpers/session-fixture.js");
  saveAuthSession({ authResult: { mode: "api", data: { access_token: token(3600, "outra-conta"), user: { ...user, id: 200, name: "Outra pessoa", email: "outra@example.test" } } } });
  finish(success(user));
  await assert.rejects(request, /sessão/i);
  assert.equal(getAuthSession().user.id, 200);
});

test("refresh da mesma sessão preserva o action_token de OTP recebido em paralelo", async () => {
  startSession();
  let finish;
  const { token } = await import("./helpers/session-fixture.js");
  globalThis.fetch = async (url) => {
    if (url.endsWith("/refresh")) return success({ access_token: token(3600, "renovado-em-paralelo"), token_type: "bearer", expires_in: 3600, user });
    return new Promise((resolve) => { finish = resolve; });
  };
  const request = (await api()).validateAccountDeletionCode("123456");
  await new Promise((resolve) => setImmediate(resolve));
  const { refreshAuthSession } = await import("../src/app/session-api.js");
  await refreshAuthSession();
  finish(success({ action_token: "confirmacao-preservada" }));
  assert.equal(await request, "confirmacao-preservada");
});

test("reautenticar a mesma conta não permite resposta da sessão anterior", async () => {
  startSession();
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const request = (await api()).getCurrentUser();
  await new Promise((resolve) => setImmediate(resolve));
  startSession();
  finish(success(user));
  await assert.rejects(request, /sessão/i);
});

test("401 do JWT anterior durante refresh repete a requisição uma vez com o JWT atual", async () => {
  startSession();
  let finish;
  let calls = 0;
  const { token } = await import("./helpers/session-fixture.js");
  const newToken = token(3600, "jwt-atual");
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/refresh")) return success({ access_token: newToken, token_type: "bearer", expires_in: 3600, user });
    calls++;
    if (calls === 1) return new Promise((resolve) => { finish = resolve; });
    assert.equal(options.headers.Authorization, `Bearer ${newToken}`);
    return success(user);
  };
  const request = (await api()).getCurrentUser();
  await new Promise((resolve) => setImmediate(resolve));
  await (await import("../src/app/session-api.js")).refreshAuthSession();
  finish(Response.json({ message: "Unauthenticated." }, { status: 401 }));
  assert.equal((await request).id, user.id);
  assert.equal(calls, 2);
  assert.ok(getAuthSession());
});

test("401 aguarda refresh pendente antes de repetir a requisição protegida", async () => {
  startSession();
  let finishRequest;
  let finishRefresh;
  let calls = 0;
  const { token } = await import("./helpers/session-fixture.js");
  const renewed = token(3600, "refresh-ainda-pendente");
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/refresh")) return new Promise((resolve) => { finishRefresh = resolve; });
    calls++;
    if (calls === 1) return new Promise((resolve) => { finishRequest = resolve; });
    assert.equal(options.headers.Authorization, `Bearer ${renewed}`);
    return success(user);
  };
  const request = (await api()).getCurrentUser();
  const observed = request.then((value) => ({ value }), (error) => ({ error }));
  await new Promise((resolve) => setImmediate(resolve));
  const refresh = (await import("../src/app/session-api.js")).refreshAuthSession();
  const refreshed = refresh.then((value) => ({ value }), (error) => ({ error }));
  await new Promise((resolve) => setImmediate(resolve));
  finishRequest(Response.json({ message: "Unauthenticated." }, { status: 401 }));
  await new Promise((resolve) => setImmediate(resolve));
  const keptSessionWhileRefreshing = Boolean(getAuthSession());
  finishRefresh(success({ access_token: renewed, token_type: "bearer", expires_in: 3600, user }));
  const [response, renewal] = await Promise.all([observed, refreshed]);
  assert.equal(keptSessionWhileRefreshing, true, "401 não pode encerrar a sessão durante a renovação.");
  assert.equal(response.error, undefined);
  assert.equal(renewal.error, undefined);
  assert.equal(response.value.id, user.id);
  assert.equal(calls, 2);
  assert.equal(getAuthSession().accessToken, renewed);
});
