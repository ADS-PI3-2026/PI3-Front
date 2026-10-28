import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getBrandYears } from "../src/app/garagem/_lib/fipe-api.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("ordena os anos da FIPE do mais recente para o mais antigo", async () => {
  globalThis.fetch = async () => Response.json([
    { code: "2019-1", name: "2019 Gasolina" },
    { code: "2025-1", name: "2025 Gasolina" },
    { code: "32000", name: "32000 Gasolina" },
    { code: "2023-3", name: "2023 Diesel" },
    { code: "2023-1", name: "2023 Gasolina" },
  ]);

  const years = await getBrandYears("cars", "56");

  assert.deepEqual(
    years.map((year) => year.code),
    ["2025-1", "2023-3", "2023-1", "2019-1"],
  );
});
