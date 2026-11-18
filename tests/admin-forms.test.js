import assert from "node:assert/strict";
import { test } from "node:test";

const forms = () => import("../src/app/admin/_lib/admin-forms.js");

test("atualização do servidor preserva rascunhos e sincroniza atributos que não foram editados", async () => {
  const { reconcileServiceDraft, buildServicePayload } = await forms();
  const initial = {
    name: "Óleo",
    identifier: "oleo",
    description: "Texto original",
    is_active: true,
  };
  const draft = { ...initial, name: "Óleo e filtros" };
  const incoming = {
    ...initial,
    description: "Texto atualizado por outra conta",
    is_active: false,
  };
  const result = reconcileServiceDraft({ initial, form: draft }, incoming);
  assert.equal(result.form.name, "Óleo e filtros");
  assert.equal(result.form.description, incoming.description);
  assert.equal(result.form.is_active, false);
  assert.deepEqual(buildServicePayload(result.form, result.initial), {
    name: "Óleo e filtros",
  });
});

test("parâmetro do Next é decodificado uma vez, inclusive quando o identificador contém porcentagem", async () => {
  const { decodeServiceIdentifier } = await forms();
  assert.equal(
    decodeServiceIdentifier("revis%C3%A3o%20geral"),
    "revisão geral",
  );
  assert.equal(decodeServiceIdentifier("peca%2520especial"), "peca%20especial");
});

test("identificador permite acentos e espaços e impede segmentos que a rota não representa", async () => {
  const { getServiceIdentifierError } = await forms();
  assert.equal(getServiceIdentifierError("revisão geral"), "");
  for (const value of [".", "..", "oleo/filtro"])
    assert.ok(getServiceIdentifierError(value));
});

test("editar só o nome não sobrescreve status e descrição de outro administrador", async () => {
  const { buildServicePayload } = await forms();
  const initial = {
    name: "Óleo",
    identifier: "oleo",
    description: "Texto original",
    is_active: true,
  };
  assert.deepEqual(
    buildServicePayload({ ...initial, name: "Óleo e filtros" }, initial),
    { name: "Óleo e filtros" },
  );
  assert.deepEqual(
    buildServicePayload({ ...initial, is_active: false }, initial),
    { is_active: false },
  );
  assert.deepEqual(
    buildServicePayload({ ...initial, description: "" }, initial),
    { description: "" },
  );
  assert.deepEqual(buildServicePayload(initial, initial), {});
});

test("opções associativas são exibidas e preservadas ao alterar outro atributo do campo", async () => {
  const { createServiceFieldDraft, buildServiceFieldPayload } = await forms();
  const field = {
    id: 2,
    name: "marca",
    display_name: "Marca",
    field_type: "select",
    options: { a: "Mobil", b: "Castrol" },
    order: 0,
    required: true,
  };
  const initial = createServiceFieldDraft(field, [field]);
  assert.equal(initial.options, "Mobil\nCastrol");
  assert.deepEqual(
    buildServiceFieldPayload(
      { ...initial, display_name: "Marca do óleo" },
      initial,
    ),
    { display_name: "Marca do óleo" },
  );
});

test("edição de texto preserva o tipo legado e permite limpar uma dependência", async () => {
  const { createServiceFieldDraft, buildServiceFieldPayload } = await forms();
  const field = {
    id: 7,
    name: "quantidade",
    display_name: "Quantidade",
    field_type: "decimal",
    required: false,
    required_if_field_filled: "troca",
    order: 1,
  };
  const initial = createServiceFieldDraft(field, [field]);
  assert.deepEqual(
    buildServiceFieldPayload(
      { ...initial, required_if_field_filled: "" },
      initial,
    ),
    { required_if_field_filled: null },
  );
});

test("campos de escolha obrigatórios exigem ao menos uma opção utilizável", async () => {
  const { createServiceFieldDraft, validateServiceField } = await forms();
  for (const type of ["select", "radio", "checkbox"]) {
    const form = {
      ...createServiceFieldDraft(null, []),
      name: "campo",
      display_name: "Campo",
      field_type: type,
      options: " \n ",
    };
    assert.ok(validateServiceField({ ...form, required: true }, []).options);
    assert.ok(
      validateServiceField({ ...form, required_if_field_filled: "outro" }, [])
        .options,
    );
    assert.equal(
      validateServiceField(
        { ...form, required: true, options: "Uma opção" },
        [],
      ).options,
      undefined,
    );
    assert.equal(validateServiceField(form, []).options, undefined);
  }
});
