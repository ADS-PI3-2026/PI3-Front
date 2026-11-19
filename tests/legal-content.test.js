import assert from "node:assert/strict";
import { test } from "node:test";
const content = () => import("../src/app/lib/legal-html.js");

test("HTML legal preserva títulos, listas e formatação sem código executável", async () => {
  const { sanitizeLegalHtml } = await content();
  const cleaned = sanitizeLegalHtml('<h2>Título</h2><p onclick="alert(1)"><strong>Texto</strong><em>ênfase</em></p><ul><li>Item</li></ul><script>alert(2)</script><img src=x onerror=alert(3)><a href="javascript:alert(4)">link</a>');
  assert.match(cleaned, /<h2>Título<\/h2>/);
  assert.match(cleaned, /<strong>Texto<\/strong>/);
  assert.match(cleaned, /<ul><li>Item<\/li><\/ul>/);
  assert.doesNotMatch(cleaned, /onclick|onerror|script|<img|alert\(/i);
});

test("HTML legal remove iframes, formulários e CSS externo sem remover texto comum", async () => {
  const { sanitizeLegalHtml, hasLegalText } = await content();
  const cleaned = sanitizeLegalHtml('<iframe src="https://example.com"></iframe><form action="/sair"><input name=x><p style="background:url(https://example.com);text-align:center">Texto</p></form>');
  assert.doesNotMatch(cleaned, /iframe|<form|<input|url\(/);
  assert.match(cleaned, /text-align:center/);
  assert.equal(hasLegalText(cleaned), true);
  for (const value of [null, "", "<p><br></p>", "<p>&nbsp; \n</p>", "<script>texto</script>"])
    assert.equal(hasLegalText(value), false);
});
