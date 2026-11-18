export function decodeServiceIdentifier(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getServiceIdentifierError(value) {
  const identifier = value.trim();
  if (!identifier) return "Informe o identificador.";
  if (identifier.includes("/") || [".", ".."].includes(identifier)) {
    return "Use um identificador sem barras e diferente de ponto ou dois pontos.";
  }
  return "";
}

export function createServiceDraft(service) {
  return {
    name: service?.name ?? "",
    identifier: service?.identifier ?? "",
    description: service?.description ?? "",
    is_active: service?.is_active ?? true,
  };
}

export function buildServicePayload(form, original = null) {
  const values = {
    name: form.name.trim(),
    description: form.description.trim(),
    is_active: form.is_active,
  };
  if (!original) return { ...values, identifier: form.identifier.trim() };
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => form[key] !== original[key]),
  );
}

export function reconcileServiceDraft(state, service) {
  const initial = createServiceDraft(service);
  const form = Object.fromEntries(
    Object.keys(initial).map((key) => [
      key,
      state.form[key] === state.initial[key] ? initial[key] : state.form[key],
    ]),
  );
  return { initial, form };
}

function choiceOptions(form) {
  return form.options
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createServiceFieldDraft(field, fields) {
  const options = Object.values(field?.options ?? {});
  return {
    name: field?.name ?? "",
    display_name: field?.display_name ?? "",
    description: field?.description ?? "",
    field_type: field?.field_type ?? "text",
    options: options
      .map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      )
      .join("\n"),
    required: field?.required ?? false,
    required_if_field_filled: field?.required_if_field_filled ?? "",
    order: String(
      field?.order ??
        (fields.length ? Math.max(...fields.map((item) => item.order)) + 1 : 0),
    ),
  };
}

export function validateServiceField(form, fields, fieldId = null) {
  const errors = {};
  if (!form.display_name.trim())
    errors.display_name = "Informe o nome exibido no formulário.";
  if (fieldId == null && !/^[a-z0-9_]+$/.test(form.name)) {
    errors.name = "Use letras minúsculas, números e sublinhado, sem espaços.";
  }
  if (fieldId == null && fields.some((field) => field.name === form.name)) {
    errors.name = "Este identificador já existe neste tipo de serviço.";
  }
  if (!/^\d+$/.test(form.order) || !Number.isSafeInteger(Number(form.order))) {
    errors.order = "Informe um número inteiro a partir de zero.";
  }
  const choice = ["select", "radio", "checkbox"].includes(form.field_type);
  if (
    choice &&
    (form.required || form.required_if_field_filled) &&
    !choiceOptions(form).length
  ) {
    errors.options = "Informe ao menos uma opção para um campo obrigatório.";
  }
  return errors;
}

export function buildServiceFieldPayload(form, original = null) {
  const choice = ["select", "radio", "checkbox"].includes(form.field_type);
  const values = {
    display_name: form.display_name.trim(),
    description: form.description.trim() || null,
    field_type: form.field_type,
    required: form.required,
    required_if_field_filled: form.required_if_field_filled || null,
    order: Number(form.order),
    options: choice ? choiceOptions(form) : null,
  };
  if (!original) return { ...values, name: form.name };
  // Campos não alterados mantêm sua representação e seus tipos originais na API.
  for (const key of Object.keys(values)) {
    if (String(form[key] ?? "") === String(original[key] ?? ""))
      delete values[key];
  }
  if (form.field_type !== original.field_type)
    values.options = choice ? choiceOptions(form) : null;
  return values;
}
