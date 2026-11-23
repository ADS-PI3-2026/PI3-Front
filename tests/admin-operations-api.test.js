import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { installStorage, startSession, success } from "./helpers/session-fixture.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
beforeEach(() => {
  installStorage(); startSession();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});
const api = () => import("../src/app/admin/operations-api.js");
const client = { id: 21, name: "Cliente de teste", email: "cliente@example.test", document_type: "CPF", document: "52998224725", roles: ["client"], vehicles_count: 2, is_deleted: false, created_at: "2026-11-20 14:00:00", updated_at: "2026-11-20 14:00:00", deleted_at: null };
const vehicle = { id: 31, user_id: 21, type: "car", brand: "Toyota", brand_code: "56", model: "Corolla", year: 2024, plate: "ABC1D23", has_renavam: true, mileage: 0, color: "Branco", maintenances_count: 0, maintenance_alerts_count: 0, transfers_count: 1, user: client, active_transfer: null, created_at: "2026-11-20 14:00:00", updated_at: "2026-11-20 14:00:00", deleted_at: null };
const transfer = { id: 41, vehicle_id: 31, current_owner_id: 21, recipient_id: 22, recipient_email: "destinatario@example.test", initiated_by: "owner", status: "pending", is_expired: false, owner_validated_at: null, recipient_validated_at: null, failed_attempts: 0, expires_at: "2026-11-25 14:00:00", vehicle, current_owner: client, recipient: { ...client, id: 22, email: "destinatario@example.test" }, created_at: "2026-11-20 14:00:00", updated_at: "2026-11-20 14:00:00" };
const log = { id: 51, summary: "Atualizou Veículo #31", event: "updated", entity: "Veículo", entity_type: "Vehicle", entity_id: 31, old_values: { mileage: 0 }, new_values: { mileage: 5000 }, ip_address: null, user_agent: null, user: null, created_at: "2026-11-20 14:00:00" };

test("usuários comuns usam a nova rota, filtro exato de documento e paginação real", async () => {
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/api/admin/users");
    assert.equal(parsed.searchParams.get("filter[document]"), "52998224725");
    assert.equal(parsed.searchParams.get("filter[include_deleted]"), "1");
    assert.equal(parsed.searchParams.get("sort"), "-vehicles_count");
    assert.equal(parsed.searchParams.get("page"), "2");
    assert.equal(options.method, "GET"); assert.match(options.headers.Authorization, /^Bearer /);
    return success({ data: [client], meta: { current_page: 2, last_page: 4, total: 47 } });
  };
  const result = await (await api()).listAdminUsers({ page: 2, sort: "-vehicles_count", filters: { document: "529.982.247-25", include_deleted: true } });
  assert.equal(result.total, 47); assert.equal(result.page, 2); assert.equal(result.lastPage, 4); assert.equal(result.items[0].id, 21);
});

test("veículos combinam proprietário, placa normalizada e exclusão sem enviar filtros desconhecidos", async () => {
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("filter[user_id]"), "21");
    assert.equal(query.get("filter[plate]"), "ABC1D23");
    assert.equal(query.has("filter[include_deleted]"), false);
    assert.equal(query.has("filter[password]"), false);
    return success({ data: [vehicle], meta: { current_page: 1, last_page: 1, total: 1 } });
  };
  const result = await (await api()).listAdminVehicles({ filters: { user_id: "21", plate: "abc-1d23", include_deleted: false, password: "não enviar" } });
  assert.equal(result.items[0].mileage, 0);
});

test("busca de CNPJ alfanumérico preserva letras e normaliza pontuação e caixa", async () => {
  let document;
  globalThis.fetch = async url => {
    document = new URL(url).searchParams.get("filter[document]");
    return success({ data: [{ ...client, document_type: "CNPJ", document: "12ABC34501DE35" }], meta: { current_page: 1, last_page: 1, total: 1 } });
  };
  assert.equal((await (await api()).listAdminUsers({ filters: { document: "12.abc.345/01de-35" } })).items[0].document, "12ABC34501DE35");
  assert.equal(document, "12ABC34501DE35");
});

test("resultado que encolhe recupera a última página válida preservando filtros e ordenação", async () => {
  const pages = [];
  globalThis.fetch = async url => {
    const query = new URL(url).searchParams;
    pages.push(query.get("page"));
    assert.equal(query.get("filter[status]"), "pending,expired");
    assert.equal(query.get("sort"), "expires_at");
    return query.get("page") === "2"
      ? success({ data: [], meta: { current_page: 2, last_page: 1, total: 15 } })
      : success({ data: [transfer], meta: { current_page: 1, last_page: 1, total: 15 } });
  };
  const result = await (await api()).listAdminTransfers({ page: 2, sort: "expires_at", filters: { status: "pending,expired" } });
  assert.equal(result.page, 1); assert.equal(result.items[0].id, 41);
  assert.deepEqual(pages, ["2", "1"]);
});

test("transferências em aberto consultam pendentes e expiradas com ordenação permitida", async () => {
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/api/admin/transfers");
    assert.equal(parsed.searchParams.get("filter[status]"), "pending,expired");
    assert.equal(parsed.searchParams.get("filter[recipient_email]"), "pessoa@example.test");
    assert.equal(parsed.searchParams.get("sort"), "-failed_attempts");
    return success({ data: [transfer], meta: { current_page: 1, last_page: 1, total: 1 } });
  };
  assert.equal((await (await api()).listAdminTransfers({ sort: "-failed_attempts", filters: { status: "pending,expired", recipient_email: "pessoa@example.test" } })).total, 1);
});

test("auditoria combina período, entidade, evento, autor e registro na mesma consulta", async () => {
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams;
    for (const [key, value] of Object.entries({ date_from: "2026-11-01", date_to: "2026-11-22", entity_type: "Vehicle", event: "updated", user_id: "21", auditable_id: "31" })) assert.equal(query.get(`filter[${key}]`), value);
    return success({ data: [log], meta: { current_page: 1, last_page: 1, total: 1 } });
  };
  const result = await (await api()).listAdminAuditLogs({ filters: { date_from: "2026-11-01", date_to: "2026-11-22", entity_type: "Vehicle", event: "updated", user_id: "21", auditable_id: "31" } });
  assert.equal(result.items[0].user, null); assert.equal(result.items[0].old_values.mileage, 0);
});

test("detalhes usam IDs validados e recusam resposta referente a outro registro", async () => {
  const resource = { users: { ...client, vehicles: [vehicle] }, vehicles: vehicle, transfers: transfer, "audit-logs": log };
  globalThis.fetch = async url => {
    const segment = new URL(url).pathname.split("/").at(-2);
    return success(resource[segment]);
  };
  const endpoints = await api();
  assert.equal((await endpoints.getAdminUser(21)).vehicles.length, 1);
  assert.equal((await endpoints.getAdminVehicle(31)).has_renavam, true);
  assert.equal((await endpoints.getAdminTransfer(41)).failed_attempts, 0);
  assert.equal((await endpoints.getAdminAuditLog(51)).entity_type, "Vehicle");
  globalThis.fetch = async () => success({ ...client, id: 999 });
  await assert.rejects(endpoints.getAdminUser(21), /resposta inesperada/);
  let requests = 0; globalThis.fetch = async () => { requests++; return success(null); };
  for (const id of [0, -1, "../users", null]) await assert.rejects(endpoints.getAdminVehicle(id));
  assert.equal(requests, 0);
});

test("mediação envia apenas RENAVAM como texto e só aceita conclusão confirmada pela API", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/admin/transfers/41/mediate-complete");
    assert.equal(options.method, "POST"); assert.match(options.headers.Authorization, /^Bearer /);
    assert.deepEqual(JSON.parse(options.body), { renavam: "00123456789" });
    return success({ ...transfer, status: "completed" });
  };
  assert.equal((await (await api()).completeAdminTransfer(41, "00.123.456.789")).status, "completed");
  globalThis.fetch = async () => success(transfer);
  await assert.rejects((await api()).completeAdminTransfer(41, "00123456789"), /conclusão/);
});

test("erros de mediação e de autorização não se tornam sucesso, e entrada vazia não faz POST", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ status: "error", message: "RENAVAM não confere." }, { status: 422 }); };
  await assert.rejects((await api()).completeAdminTransfer(41, "")); assert.equal(count, 0);
  await assert.rejects((await api()).completeAdminTransfer(41, "00123456789"), error => error.status === 422);
  globalThis.fetch = async () => Response.json({ status: "error" }, { status: 403 });
  await assert.rejects((await api()).listAdminUsers(), error => error.status === 403);
});
