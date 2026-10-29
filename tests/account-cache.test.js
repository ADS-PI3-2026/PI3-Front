import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { installStorage, startSession, success } from "./helpers/session-fixture.js";
import { requestAccount } from "../src/app/account-api.js";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
const originalNow = Date.now;
beforeEach(() => { installStorage(); startSession(); process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
const list = () => requestAccount("/vehicles", { method: "GET", cacheForMs: 30000 });

test("voltar à garagem dentro de 30 segundos reutiliza a lista sem outro GET", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success([{ id: calls }]); };
  assert.equal((await list()).data[0].id, 1);
  assert.equal((await list()).data[0].id, 1);
  assert.equal(calls, 1);
});

test("cache vencido busca dados novos e permite ler a lista anterior durante a atualização", async () => {
  const clock = originalNow();
  Date.now = () => clock;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success([{ id: calls }]); };
  await list();
  Date.now = () => clock + 30001;
  const { getCachedAccountResponse } = await import("../src/app/account-api.js");
  assert.equal(getCachedAccountResponse("/vehicles"), null);
  assert.equal(getCachedAccountResponse("/vehicles", { allowStale: true }).data[0].id, 1);
  assert.equal((await list()).data[0].id, 2);
  assert.equal(calls, 2);
});

test("GETs concorrentes iguais compartilham a mesma requisição", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return success([{ id: 7 }]);
  };
  const results = await Promise.all([list(), list(), list()]);
  assert.ok(results.every((result) => result.data[0].id === 7));
  assert.equal(calls, 1);
});

test("alterar dados invalida o cache para a próxima abertura da garagem", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success([{ id: calls }]); };
  await list();
  await requestAccount("/vehicles/7", { method: "PATCH", payload: { mileage: 1000 } });
  assert.equal((await list()).data[0].id, 3);
  assert.equal(calls, 3);
});

test("dados de outra autenticação nunca reutilizam o cache da conta anterior", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return success([{ id: calls }]); };
  await list();
  startSession();
  assert.equal((await list()).data[0].id, 2);
});

test("falha de GET não fica em cache e pode ser tentada novamente", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? Response.json({ message: "Falha" }, { status: 500 }) : success([]);
  };
  await assert.rejects(list());
  assert.deepEqual((await list()).data, []);
  assert.equal(calls, 2);
});

test("um GET antigo não repopula o cache depois de uma alteração", async () => {
  let finish;
  let reads = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method !== "GET") return success();
    reads++;
    if (reads === 1) return new Promise((resolve) => { finish = resolve; });
    return success([{ id: 2 }]);
  };
  const oldRequest = list();
  await new Promise((resolve) => setImmediate(resolve));
  await requestAccount("/vehicles/7", { method: "PATCH", payload: { mileage: 2000 } });
  finish(success([{ id: 1 }]));
  await oldRequest;
  assert.equal((await list()).data[0].id, 2);
  assert.equal(reads, 2);
});
