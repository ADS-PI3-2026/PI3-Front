import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { getAuthSession } from "../src/app/auth-session.js";
import { installStorage, startSession, success, user } from "./helpers/session-fixture.js";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
const settle = () => new Promise((resolve) => setImmediate(resolve));
let sync;

beforeEach(() => {
  installStorage();
  startSession();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
});
afterEach(() => {
  sync?.stop(); sync = null;
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
const start = async (onFeedback = () => {}) => {
  const { startProfileSync } = await import("../src/app/perfil/profile-sync.js");
  sync = startProfileSync(onFeedback);
  await settle();
  return sync;
};

test("entrar no perfil mantém a sessão disponível enquanto busca e publica o e-mail atual", async () => {
  let finish;
  const requests = [];
  globalThis.fetch = (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve) => { finish = resolve; });
  };
  await start();
  assert.equal(getAuthSession().user.email, "conta@example.test");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://localhost:8000/api/me");
  assert.equal(requests[0].options.method, "GET");
  finish(success({ ...user, email: "email-atualizado@example.test" }));
  await settle();
  assert.equal(getAuthSession().user.email, "email-atualizado@example.test");
});

test("voltar ao perfil consulta novamente e detecta alteração feita em outro dispositivo", async () => {
  let email = "conta@example.test";
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success({ ...user, email }); };
  await start();
  sync.stop();
  email = "outro-dispositivo@example.test";
  await start();
  assert.equal(getAuthSession().user.email, "outro-dispositivo@example.test");
  assert.equal(calls, 2);
});

test("voltar o foco ao perfil revalida sem duplicar consultas simultâneas", async () => {
  globalThis.fetch = async () => success(user);
  await start();
  let finish;
  let calls = 0;
  globalThis.fetch = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  await settle();
  finish(success({ ...user, email: "apos-retorno@example.test" }));
  await settle();
  assert.equal(calls, 1);
  assert.equal(getAuthSession().user.email, "apos-retorno@example.test");
});

test("ocultar a aba e sair do perfil não dispara consultas", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success(user); };
  await start();
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  await settle();
  sync.stop();
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  await settle();
  assert.equal(calls, 1);
});

test("uma falha avisa que os dados podem estar antigos e permite nova tentativa sem perder a sessão", async () => {
  const feedback = [];
  globalThis.fetch = async () => Response.json({ message: "Falha" }, { status: 503 });
  await start((message) => feedback.push(message));
  assert.equal(getAuthSession().user.email, "conta@example.test");
  assert.match(feedback.at(-1), /desatualizados/i);
  globalThis.fetch = async () => success({ ...user, email: "apos-tentar@example.test" });
  await sync.refresh();
  assert.equal(getAuthSession().user.email, "apos-tentar@example.test");
  assert.equal(feedback.at(-1), "");
});

test("montagem descartada antes da consulta não envia uma requisição extra", async () => {
  const { startProfileSync } = await import("../src/app/perfil/profile-sync.js");
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success(user); };
  const discarded = startProfileSync(() => {});
  discarded.stop();
  sync = startProfileSync(() => {});
  await settle();
  assert.equal(calls, 1);
});
