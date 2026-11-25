import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { installStorage, startSession, success } from "./helpers/session-fixture.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
const api = () => import("../src/app/legal-api.js");
beforeEach(async () => {
  installStorage();
  startSession();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
  (await api()).invalidatePublicLegalDocumentCache();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
test("documento público usa a chave correta, sem enviar sessão e sem cache HTTP", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/settings/privacy_policy");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.cache, "no-store");
    return success({ key: "privacy_policy", value: "<p>Texto atual.</p>", updated_at: "2026-11-19T00:00:00Z" });
  };
  assert.equal((await (await api()).getPublicLegalDocument("privacy")).html, "<p>Texto atual.</p>");
});

test("pré-carrega os documentos públicos e reutiliza o resultado em memória", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const privacy = url.endsWith("/privacy_policy");
    return success({
      key: privacy ? "privacy_policy" : "terms_of_use",
      value: privacy ? "<p>Política.</p>" : "<p>Termos.</p>",
    });
  };
  const client = await api();

  await client.preloadPublicLegalDocuments();
  await client.getPublicLegalDocument("terms");
  await client.getPublicLegalDocument("privacy");

  assert.deepEqual(calls.sort(), [
    "http://localhost:8000/api/settings/privacy_policy",
    "http://localhost:8000/api/settings/terms_of_use",
  ]);
});

test("documento público ausente, vazio ou com resposta trocada não usa texto estático", async () => {
  for (const data of [null, { key: "terms_of_use", value: "<p>&nbsp;</p>" }, { key: "privacy_policy", value: "<p>Outro documento.</p>" }]) {
    globalThis.fetch = async () => success(data);
    await assert.rejects((await api()).getPublicLegalDocument("terms"));
  }
});

test("admin carrega configurações legais e publica somente o documento selecionado", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "PUT") return success(null);
    return success([
      { key: "terms_of_use", value: "<p>Termos.</p>", updated_at: "2026-11-19T00:00:00Z" },
      { key: "privacy_policy", value: "<p>Privacidade.</p>", updated_at: "2026-11-19T00:00:00Z" },
    ]);
  };
  const client = await api();
  const documents = await client.listAdminLegalDocuments();
  assert.equal(documents.terms.html, "<p>Termos.</p>");
  assert.equal(documents.privacy.html, "<p>Privacidade.</p>");
  await client.saveAdminLegalDocument("terms", '<p onclick="alert(1)"><strong>Alterado.</strong></p>');
  const saved = calls.find(call => call.options.method === "PUT");
  assert.equal(calls[0].url, "http://localhost:8000/api/admin/settings?group=legal");
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  assert.equal(saved.url, "http://localhost:8000/api/admin/settings/batch");
  assert.deepEqual(JSON.parse(saved.options.body), { settings: [{ key: "terms_of_use", value: "<p><strong>Alterado.</strong></p>" }] });
});

test("não publica documento vazio ou chave desconhecida e propaga falha do servidor", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ status: "error" }, { status: 503 }); };
  await assert.rejects((await api()).saveAdminLegalDocument("terms", "<p><br></p>"));
  await assert.rejects((await api()).saveAdminLegalDocument("desconhecido", "<p>Teste</p>"));
  assert.equal(count, 0);
  await assert.rejects((await api()).saveAdminLegalDocument("terms", "<p>Texto.</p>"), error => error.status === 503);
});

test("rascunho desatualizado não sobrescreve uma publicação de outra sessão", async () => {
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "PUT") writes++;
    return success([
      { key: "terms_of_use", value: "<p>Versão mais recente.</p>" },
      { key: "privacy_policy", value: "<p>Política.</p>" },
    ]);
  };
  await assert.rejects((await api()).saveAdminLegalDocument("terms", "<p>Meu rascunho.</p>", { expectedHtml: "<p>Versão anterior.</p>" }), /atualizado/);
  assert.equal(writes, 0);
});
