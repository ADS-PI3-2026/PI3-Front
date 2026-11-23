import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import {
  installStorage,
  startSession,
  success,
  user,
} from "./helpers/session-fixture.js";
import { getAuthSession } from "../src/app/auth-session.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
beforeEach(() => {
  installStorage();
  startSession();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
const api = () => import("../src/app/admin/admin-api.js");

test("resumo administrativo usa totais da API, inclusive fora da primeira página", async () => {
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    const resource = parsed.pathname.split("/").at(-1);
    const total = resource === "internal-users" ? 31
      : resource === "users" ? 47 : resource === "vehicles" ? 92
      : resource === "transfers" ? 8
      : parsed.searchParams.get("filter[is_active]") === "1" ? 9 : 22;
    return success({ data: [], meta: { current_page: 1, last_page: 3, total } });
  };
  assert.deepEqual(await (await api()).getAdminOverview(), {
    administrators: 31, users: 47, vehicles: 92, openTransfers: 8, services: 22, activeServices: 9,
  });
});

test("resumo não converte erro da API em total zero", async () => {
  globalThis.fetch = async () => Response.json({ status: "error" }, { status: 503 });
  await assert.rejects((await api()).getAdminOverview(), error => error.status === 503);
});

test("admin interpreta a paginação Laravel e envia filtro e ordenação sem perder a página", async () => {
  globalThis.fetch = async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("page"), "2");
    assert.equal(query.get("filter[email]"), "equipe@example.test");
    assert.equal(query.get("sort"), "-created_at");
    assert.equal(options.method, "GET");
    assert.match(options.headers.Authorization, /^Bearer /);
    return success({
      data: [{ id: 101, name: "Equipe" }],
      meta: { current_page: 2, last_page: 3, total: 35 },
    });
  };
  const page = await (
    await api()
  ).listInternalUsers({
    page: 2,
    search: "equipe@example.test",
    searchBy: "email",
    sort: "-created_at",
  });
  assert.equal(page.total, 35);
  assert.equal(page.page, 2);
  assert.equal(page.lastPage, 3);
  assert.equal(page.items.length, 1);
});

test("admin diferencia lista vazia válida de resposta inválida", async () => {
  globalThis.fetch = async () =>
    success({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
  assert.equal((await (await api()).listAdminServiceTypes()).total, 0);
  globalThis.fetch = async () => success({ unexpected: [] });
  await assert.rejects(
    (await api()).listAdminServiceTypes(),
    /resposta inesperada/,
  );
});

test("serviços preservam false e usam identifier codificado em todas as operações", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return success({
      name: "Revisão",
      identifier: "revisão geral",
      is_active: 0,
    });
  };
  const client = await api();
  const service = await client.getAdminServiceType("revisão geral");
  assert.equal(service.is_active, false);
  await client.saveAdminServiceType("revisão geral", {
    name: "Revisão",
    is_active: false,
  });
  await client.deleteAdminServiceType("revisão geral");
  assert.ok(
    calls.every((call) =>
      call.url.endsWith("/admin/service-types/revis%C3%A3o%20geral"),
    ),
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    name: "Revisão",
    is_active: false,
  });
  assert.equal(calls[2].options.method, "DELETE");
});

test("campos seguem o contrato de lote e ativação da API", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return success([]);
  };
  const client = await api();
  await client.saveServiceField("oleo", null, {
    name: "marca",
    field_type: "text",
    required: false,
    order: 0,
  });
  await client.saveServiceField("oleo", 17, {
    display_name: "Marca do óleo",
    required_if_field_filled: null,
  });
  await client.setServiceFieldActive("oleo", 17, false);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    fields: [{ name: "marca", field_type: "text", required: false, order: 0 }],
  });
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    fields: [
      { id: 17, display_name: "Marca do óleo", required_if_field_filled: null },
    ],
  });
  assert.ok(calls[2].url.endsWith("/fields/17/disable"));
});

test("editar a própria conta atualiza os dados da sessão somente após sucesso real", async () => {
  globalThis.fetch = async () =>
    success({ ...user, name: "Nome revisado", roles: ["admin"] });
  await (
    await api()
  ).saveInternalUser(user.id, { name: "Nome revisado", email: user.email });
  assert.equal(getAuthSession().user.name, "Nome revisado");
});

test("erros de campo em lote mantêm mensagens úteis e falhas internas ficam genéricas", async () => {
  const client = await api();
  assert.deepEqual(
    client.getAdminFieldErrors({
      status: 422,
      data: {
        errors: {
          "fields.0.display_name": ["Informe o nome."],
          "fields.0.options.0": ["Opção inválida."],
        },
      },
    }),
    { display_name: "Informe o nome.", options: "Opção inválida." },
  );
  assert.deepEqual(
    client.getAdminFieldErrors({
      status: 500,
      data: { errors: { name: ["SQLSTATE segredo"] } },
    }),
    {},
  );
  assert.doesNotMatch(
    client.getAdminErrorMessage({
      status: 500,
      data: { message: "SQLSTATE segredo" },
    }),
    /SQLSTATE|segredo/,
  );
});

test("401 encerra sessão e 403 preserva a sessão sem simular sucesso", async () => {
  globalThis.fetch = async () =>
    Response.json({ status: "error", message: "Forbidden" }, { status: 403 });
  await assert.rejects(
    (await api()).listInternalUsers(),
    (error) => error.status === 403,
  );
  assert.ok(getAuthSession());
  globalThis.fetch = async () =>
    Response.json(
      { status: "error", message: "Unauthenticated" },
      { status: 401 },
    );
  await assert.rejects(
    (await api()).listInternalUsers(),
    (error) => error.status === 401,
  );
  assert.equal(getAuthSession(), null);
});
