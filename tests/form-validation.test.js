import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCnpj, getDocumentValidationError, getEmailValidationError,
  getPasswordValidationError, getRegistrationNameValidationError, normalizeDocument,
} from "../src/app/lib/form-validation.js";

test("cadastro exige nome e respeita 255 caracteres sem inventar uma regra de sobrenome", () => {
  assert.notEqual(getRegistrationNameValidationError("   "), "");
  assert.equal(getRegistrationNameValidationError("Ana"), "");
  assert.equal(getRegistrationNameValidationError("A"), "");
  assert.equal(getRegistrationNameValidationError("a".repeat(255)), "");
  assert.match(getRegistrationNameValidationError("a".repeat(256)), /255/);
});

test("e-mail vazio, formato incorreto e excesso de tamanho são bloqueados", () => {
  assert.notEqual(getEmailValidationError(" "), "");
  assert.notEqual(getEmailValidationError("pessoa sem email"), "");
  assert.equal(getEmailValidationError(" pessoa@example.test "), "");
  assert.match(getEmailValidationError(`${"a".repeat(256)}@example.test`), /255/);
});

test("CPF e CNPJ validam dígitos verificadores e rejeitam sequências repetidas", () => {
  assert.equal(getDocumentValidationError("529.982.247-25", "person"), "");
  assert.notEqual(getDocumentValidationError("52998224724", "person"), "");
  assert.notEqual(getDocumentValidationError("11111111111", "person"), "");
  assert.equal(getDocumentValidationError("11.222.333/0001-81", "business"), "");
  assert.notEqual(getDocumentValidationError("11222333000182", "business"), "");
  assert.notEqual(getDocumentValidationError("00000000000000", "business"), "");
  assert.notEqual(getDocumentValidationError("52998224725", "unknown"), "");
});

test("CNPJ alfanumérico mantém letras na máscara e no payload, conforme CpfCnpj da API", () => {
  assert.equal(formatCnpj("12abc34501de35"), "12.ABC.345/01DE-35");
  assert.equal(normalizeDocument("12.ABC.345/01DE-35", "business"), "12ABC34501DE35");
  assert.equal(getDocumentValidationError("12.ABC.345/01DE-35", "business"), "");
  assert.notEqual(getDocumentValidationError("12ABC34501DE34", "business"), "");
  assert.notEqual(getDocumentValidationError("12ABC34501DE3A", "business"), "");
});

test("senha acompanha categorias Unicode do Laravel e conta caracteres, não unidades UTF-16", () => {
  assert.equal(getPasswordValidationError("Abcdef١!"), "");
  assert.equal(getPasswordValidationError("Abcdef1 "), "");
  assert.notEqual(getPasswordValidationError("Abcdef1\u0001"), "");
  assert.notEqual(getPasswordValidationError("Ab1!😀😀😀"), "");
  assert.equal(getPasswordValidationError("Ab1!😀😀😀😀"), "");
});

test("troca de e-mail exige um endereço novo válido, diferente do atual", async () => {
  const { getNewEmailValidationError } = await import("../src/app/lib/form-validation.js");
  assert.match(getNewEmailValidationError("", "atual@example.test"), /e-mail/);
  assert.notEqual(getNewEmailValidationError("endereco-invalido", "atual@example.test"), "");
  assert.match(getNewEmailValidationError(" ATUAL@EXAMPLE.TEST ", "atual@example.test"), /diferente/);
  assert.equal(getNewEmailValidationError(" novo@example.test ", "atual@example.test"), "");
});

test("troca de e-mail pede duas confirmações para CPF e somente a nova para CNPJ", async () => {
  const { getEmailChangeVerificationTargets } = await import("../src/app/lib/form-validation.js");
  assert.deepEqual(getEmailChangeVerificationTargets("CPF"), ["current", "new"]);
  assert.deepEqual(getEmailChangeVerificationTargets("CNPJ"), ["new"]);
  assert.equal(getEmailChangeVerificationTargets(undefined), null);
});
