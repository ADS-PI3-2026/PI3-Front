import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeVehicleTransferPrefill,
  saveVehicleTransferPrefill,
} from "../src/app/garagem/_lib/vehicle-transfer-prefill.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("leva os dados do cadastro para a transferência sem expô-los na URL", () => {
  const storage = createStorage();
  assert.equal(saveVehicleTransferPrefill({ plate: "ABC-1234", renavam: "123.456.789-00" }, storage), true);
  assert.deepEqual(consumeVehicleTransferPrefill(storage), {
    plate: "ABC-1234",
    renavam: "12345678900",
  });
  assert.equal(consumeVehicleTransferPrefill(storage), null);
});

test("não guarda sugestão sem placa", () => {
  assert.equal(saveVehicleTransferPrefill({ plate: "", renavam: "123" }, createStorage()), false);
});
