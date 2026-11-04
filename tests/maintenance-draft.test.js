import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearMaintenanceDraft,
  createMaintenanceDraftKey,
  hasMaintenanceDraftContent,
  readMaintenanceDraft,
  saveMaintenanceDraft,
} from "../src/app/garagem/_lib/maintenance-draft.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("rascunho de manutenção é isolado por usuário e veículo", () => {
  assert.equal(
    createMaintenanceDraftKey(10, 25),
    "legadocar:maintenance-draft:v1:user-10:vehicle-25",
  );
  assert.equal(createMaintenanceDraftKey(null, 25), "");
  assert.equal(createMaintenanceDraftKey(10, "inválido"), "");
});

test("salva e recupera os campos sem fingir que os anexos foram persistidos", () => {
  const storage = createStorage();
  const key = createMaintenanceDraftKey(10, 25);
  const saved = saveMaintenanceDraft(key, {
    fieldValues: { óleo: "5W30" },
    form: { category: "oleo", description: "Troca", receiptName: "nota.pdf" },
    queued: true,
  }, storage);

  assert.equal(saved, true);
  assert.deepEqual(readMaintenanceDraft(key, storage), {
    fieldValues: { óleo: "5W30" },
    form: { category: "oleo", description: "Troca", receiptName: "" },
    queued: true,
    updatedAt: readMaintenanceDraft(key, storage).updatedAt,
  });

  clearMaintenanceDraft(key, storage);
  assert.equal(readMaintenanceDraft(key, storage), null);
});

test("não cria rascunho quando o formulário ainda não possui conteúdo", () => {
  const storage = createStorage();
  const key = createMaintenanceDraftKey(10, 25);
  assert.equal(hasMaintenanceDraftContent({ status: "Realizada" }, {}), false);
  assert.equal(saveMaintenanceDraft(key, { form: { status: "Realizada" } }, storage), false);
  assert.equal(readMaintenanceDraft(key, storage), null);
});
