import { submitApiRequest } from "./auth-api.js";
import { requestAccount } from "./account-api.js";
import { legalContent } from "./lib/legal-content.js";
import { hasLegalText, sanitizeLegalHtml } from "./lib/legal-html.js";

function legalType(type) {
  if (!["terms", "privacy"].includes(type)) throw new Error("Documento inválido.");
  return legalContent[type];
}

function normalizeDocument(type, value) {
  const metadata = legalType(type);
  if (!value || value.key !== metadata.key || (value.value != null && typeof value.value !== "string"))
    throw new Error("Não foi possível carregar este documento. Tente novamente.");
  return { ...metadata, html: sanitizeLegalHtml(value.value), updatedAt: value.updated_at ?? "" };
}

export async function getPublicLegalDocument(type) {
  const metadata = legalType(type);
  const result = await submitApiRequest(`/settings/${metadata.key}`, { method: "GET", cache: "no-store" });
  const document = normalizeDocument(type, result.data);
  if (!hasLegalText(document.html)) throw new Error("Este documento ainda não está disponível. Tente novamente mais tarde.");
  return document;
}

export async function listAdminLegalDocuments() {
  const result = await requestAccount("/admin/settings?group=legal", { method: "GET", cache: "no-store" });
  if (!Array.isArray(result.data)) throw new Error("Não foi possível carregar os documentos.");
  return Object.fromEntries(["terms", "privacy"].map(type => [type, normalizeDocument(type, result.data.find(item => item.key === legalType(type).key))]));
}

export async function saveAdminLegalDocument(type, value, { expectedHtml } = {}) {
  const metadata = legalType(type);
  const html = sanitizeLegalHtml(value);
  if (!hasLegalText(html)) throw new Error("Escreva o conteúdo do documento antes de publicar.");
  if (typeof expectedHtml === "string") {
    const latest = (await listAdminLegalDocuments())[type];
    if (latest.html !== expectedHtml)
      throw new Error("Este documento foi atualizado em outra sessão. Preserve seu rascunho e recarregue o painel antes de publicar.");
  }
  await requestAccount("/admin/settings/batch", {
    method: "PUT",
    payload: { settings: [{ key: metadata.key, value: html }] },
  });
}
