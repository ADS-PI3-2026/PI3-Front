import assert from "node:assert/strict";
import { test } from "node:test";
import { legalContent } from "../src/app/lib/legal-content.js";

test("termos e privacidade possuem conteúdo real e atualizado", () => {
  for (const document of Object.values(legalContent)) {
    assert.ok(document.sections.length >= 7);
    assert.match(document.updatedAt, /2026/);
    const fullText = document.sections.flatMap((section) => section.paragraphs).join(" ");
    assert.doesNotMatch(fullText, /lorem ipsum/i);
    assert.ok(fullText.length > 1500);
  }
});
