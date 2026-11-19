import assert from "node:assert/strict";
import { test } from "node:test";

const workspace = () => import("../src/app/admin/_lib/admin-workspace.js");

test("URL ausente ou inválida abre administradores e URLs válidas reabrem a aba selecionada", async () => {
  const { resolveAdminTab } = await workspace();
  for (const value of [null, "", "qualquer", "__proto__"])
    assert.equal(resolveAdminTab(value), "administradores");
  assert.equal(resolveAdminTab("servicos"), "servicos");
  assert.equal(resolveAdminTab("textos"), "textos");
});

test("navegação das abas pelo teclado circula nos extremos e ignora teclas não relacionadas", async () => {
  const { nextAdminTab } = await workspace();
  assert.equal(nextAdminTab("administradores", "ArrowLeft"), "auditoria");
  assert.equal(nextAdminTab("auditoria", "ArrowRight"), "administradores");
  assert.equal(nextAdminTab("servicos", "Home"), "administradores");
  assert.equal(nextAdminTab("servicos", "End"), "auditoria");
  assert.equal(nextAdminTab("servicos", "Tab"), null);
});

test("links antigos mantêm filtros válidos e criação apenas na aba de serviços", async () => {
  const { adminWorkspaceHref } = await workspace();
  assert.equal(adminWorkspaceHref("servicos", { status: "0", novo: "1" }), "/admin?aba=servicos&status=0&novo=1");
  assert.equal(adminWorkspaceHref("administradores", { status: "1", novo: "1" }), "/admin?aba=administradores");
  assert.equal(adminWorkspaceHref("invalida", { status: "x" }), "/admin?aba=administradores");
});

test("filtro aplicado pelo cartão reinicia a paginação sem apagar a aba selecionada", async () => {
  const { updateAdminWorkspaceHref, readAdminPage } = await workspace();
  assert.equal(updateAdminWorkspaceHref("aba=servicos&status=0&pagina-servicos=2", { status: "1" }), "/admin?aba=servicos&status=1");
  assert.equal(updateAdminWorkspaceHref("aba=servicos&status=0&pagina-servicos=2", { aba: "administradores" }), "/admin?aba=administradores&status=0&pagina-servicos=2");
  assert.equal(readAdminPage("2"), 2);
  for (const value of [null, "", "0", "-1", "1.5", "Infinity", "abc"])
    assert.equal(readAdminPage(value), 1);
});
