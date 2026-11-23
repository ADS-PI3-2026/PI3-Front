import assert from "node:assert/strict";
import { test } from "node:test";
const operations = () => import("../src/app/admin/_lib/admin-operations.js");

test("mediação permite somente pendência ou expiração com destinatário e veículo válidos", async () => {
  const { getMediationBlockReason } = await operations();
  const valid = { status: "pending", recipient: { id: 2, deleted_at: null }, vehicle: { id: 1 } };
  assert.equal(getMediationBlockReason(valid, { has_renavam: true }), "");
  assert.equal(getMediationBlockReason({ ...valid, status: "expired" }, { has_renavam: true }), "");
  for (const change of [{ status: "completed" }, { status: "cancelled" }, { recipient: null }, { recipient: { id: 2, deleted_at: "2026-11-20" } }, { vehicle: null }]) assert.ok(getMediationBlockReason({ ...valid, ...change }, { has_renavam: true }));
  assert.ok(getMediationBlockReason(valid, { has_renavam: false }));
});

test("validação de filtros impede período invertido e IDs inválidos, aceitando campos opcionais vazios", async () => {
  const { getAdminFilterError } = await operations();
  assert.equal(getAdminFilterError({ user_id: "", date_from: "", date_to: "" }), "");
  assert.ok(getAdminFilterError({ user_id: "-1" }));
  assert.ok(getAdminFilterError({ date_from: "2026-11-22", date_to: "2026-11-01" }));
  assert.ok(getAdminFilterError({ date_from: "2026-02-31" }));
  assert.equal(getAdminFilterError({ user_id: "3", date_from: "2026-11-01", date_to: "2026-11-22" }), "");
});

test("diferenças de auditoria preservam zero, false, null e identificam propriedades adicionadas ou removidas", async () => {
  const { getAuditChanges, formatAuditValue } = await operations();
  const changes = getAuditChanges({ mileage: 0, active: false, removed: "antes", nullable: null }, { mileage: 20, active: true, added: "novo", nullable: null });
  assert.equal(changes.find(row => row.key === "mileage").before, 0);
  assert.equal(changes.find(row => row.key === "active").before, false);
  assert.equal(changes.find(row => row.key === "removed").kind, "removed");
  assert.equal(changes.find(row => row.key === "added").kind, "added");
  assert.equal(changes.some(row => row.key === "nullable"), false);
  assert.equal(formatAuditValue(null), "null"); assert.equal(formatAuditValue(undefined), "—");
  assert.equal(formatAuditValue(false), "false"); assert.equal(formatAuditValue(0), "0");
});

test("datas do backend sem fuso são interpretadas em UTC e datas inválidas não quebram o painel", async () => {
  const { parseAdminTimestamp } = await operations();
  assert.equal(parseAdminTimestamp("2026-11-20 14:30:00").toISOString(), "2026-11-20T14:30:00.000Z");
  assert.equal(parseAdminTimestamp("2026-11-20T11:30:00-03:00").toISOString(), "2026-11-20T14:30:00.000Z");
  assert.equal(parseAdminTimestamp("inválido"), null); assert.equal(parseAdminTimestamp(null), null);
});

test("diferenças de auditoria ocultam dados de validação mantendo os campos comuns", async () => {
  const { getAuditChanges } = await operations();
  const changes = getAuditChanges({ renavam: "00990000001", code: "convite-anterior", owner_otp_hash: "hash-antigo", mileage: 0 }, { renavam: "00990000002", code: "convite-novo", owner_otp_hash: "hash-novo", mileage: 100 });
  assert.deepEqual(changes.map(change => change.key), ["mileage"]);
  assert.doesNotMatch(JSON.stringify(changes), /0099000|convite-|hash-/);
});

test("auditoria pode exibir o mesmo dia UTC usado no filtro perto da meia-noite", async () => {
  const { formatAdminDateTime } = await operations();
  const original = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    assert.match(formatAdminDateTime("2026-11-22 01:00:00", "UTC"), /22\/11\/2026.*01:00 UTC$/);
    assert.match(formatAdminDateTime("2026-11-22 01:00:00"), /21\/11\/2026.*22:00$/);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("confirmação da mediação identifica a conta pelo ID e e-mail atual, preservando o endereço original no registro", async () => {
  const { getMediationConfirmation } = await operations();
  const transfer = { vehicle: { plate: "ABC1D23" }, recipient_id: 22, recipient_email: "antigo@example.test", recipient: { id: 22, name: "Destinatário", email: "atual@example.test" } };
  const message = getMediationConfirmation(transfer);
  assert.match(message, /ABC1D23/); assert.match(message, /Destinatário/);
  assert.match(message, /#22/); assert.match(message, /atual@example\.test/);
  assert.doesNotMatch(message, /antigo@example/);
  assert.equal(transfer.recipient_email, "antigo@example.test");
});
