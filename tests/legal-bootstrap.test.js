import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLegalBootstrapUpdates } from "../scripts/lib/legal-bootstrap.mjs";

test("migração dos textos anteriores substitui somente exemplos conhecidos e preserva edições", () => {
  const originals = {
    terms_of_use: { placeholder: "<p>Insira os termos...</p>", value: "<p>Termos anteriores.</p>" },
    privacy_policy: { placeholder: "<p>Insira a política...</p>", value: "<p>Política anterior.</p>" },
  };
  assert.deepEqual(buildLegalBootstrapUpdates([
    { key: "terms_of_use", value: "<p>Insira os termos...</p>" },
    { key: "privacy_policy", value: "<p>Política já editada.</p>" },
  ], originals), [{ key: "terms_of_use", value: "<p>Termos anteriores.</p>" }]);
  assert.deepEqual(buildLegalBootstrapUpdates([
    { key: "terms_of_use", value: "<p>Termos anteriores.</p>" },
    { key: "privacy_policy", value: "<p>Política anterior.</p>" },
  ], originals), []);
});
