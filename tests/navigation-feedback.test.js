import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeNavigationFeedback,
  saveNavigationFeedback,
} from "../src/app/lib/navigation-feedback.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("a mensagem de navegação é consumida uma única vez", () => {
  const storage = createStorage();
  assert.equal(saveNavigationFeedback("Veículo cadastrado.", storage), true);
  assert.equal(consumeNavigationFeedback(storage), "Veículo cadastrado.");
  assert.equal(consumeNavigationFeedback(storage), "");
});

test("não salva mensagens vazias", () => {
  assert.equal(saveNavigationFeedback("  ", createStorage()), false);
});
