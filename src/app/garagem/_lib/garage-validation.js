import { validarRenavam } from "../../lib/form-validation.js";

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidPlate(plate) {
  const value = String(plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(value) || /^[A-Z]{3}[0-9]{4}$/.test(value);
}

export function isPositiveInteger(value) {
  const digits = onlyDigits(value);
  return digits.length > 0 && Number(digits) > 0;
}

export function isNonNegativeInteger(value) {
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized) && Number.isSafeInteger(Number(normalized));
}

export function isValidDate(value) {
  const normalized = String(value ?? "");
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  const brazilianMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  const match = isoMatch ?? brazilianMatch;
  if (!match) return false;

  const day = Number(isoMatch ? match[3] : match[1]);
  const month = Number(match[2]);
  const year = Number(isoMatch ? match[1] : match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function toDateInputValue(value) {
  const normalized = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function getCurrencyDigits(value) {
  return onlyDigits(value).replace(/^0+(?=\d)/, "");
}

export function formatCurrencyInput(value, previousValue = "", deleting = false) {
  const previousDigits = getCurrencyDigits(previousValue);
  const digits = (deleting ? previousDigits.slice(0, -1) : getCurrencyDigits(value)).slice(0, 10);
  if (!digits) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(digits) / 100);
}

export function isValidMoney(value) {
  const normalized = String(value ?? "").trim().replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return false;
  return Number.isFinite(Number(normalized))
    && Number(normalized) >= 0
    && Number(normalized) <= 99999999.99;
}

export function validateVehicleForm(form) {
  const errors = {};
  const plate = String(form.plate ?? "").trim();
  const renavam = onlyDigits(form.renavam);
  const mileage = String(form.mileage ?? "").trim();

  if (!form.type) errors.type = "Selecione o tipo de veículo.";
  if (!form.brand) errors.brand = "Selecione a marca.";
  if (!form.model) errors.model = "Selecione o modelo.";
  if (!form.year) errors.year = "Selecione o ano/modelo.";
  if (!String(form.color ?? "").trim()) errors.color = "Informe a cor do veículo.";

  if (!plate) {
    errors.plate = "Informe a placa.";
  } else if (!isValidPlate(plate)) {
    errors.plate = "Use uma placa válida: ABC-1234 ou ABC1D23.";
  }

  if (!renavam) {
    errors.renavam = "Informe o RENAVAM.";
  } else if (renavam.length !== 9 && renavam.length !== 11) {
    errors.renavam = "Digite os 9 ou 11 dígitos do RENAVAM.";
  } else if (!validarRenavam(renavam)) {
    errors.renavam = "Informe um RENAVAM válido.";
  }

  if (!mileage) {
    errors.mileage = "Informe a quilometragem inicial.";
  } else if (!isNonNegativeInteger(mileage)) {
    errors.mileage = "A quilometragem deve ser um número inteiro igual ou maior que zero.";
  }

  return errors;
}

function isEmptyDynamicValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === "";
}

function isConditionalFieldRequired(field, fieldValues) {
  if (!field.requiredIfFieldFilled) return false;
  const parentValue = fieldValues[field.requiredIfFieldFilled];
  return parentValue === true || parentValue === "true"
    || (!isEmptyDynamicValue(parentValue) && parentValue !== false && parentValue !== "false");
}

export function validateMaintenanceForm(form, fields = [], fieldValues = {}) {
  const errors = {};
  const isCompleted = form.status === "Realizada";

  if (!form.status) errors.status = "Selecione o status do serviço.";
  if (!form.category) errors.category = "Selecione uma categoria.";
  if (String(form.description ?? "").trim().length > 500) {
    errors.description = "A descrição deve ter no máximo 500 caracteres.";
  }

  if (isCompleted) {
    if (!isValidDate(form.date)) errors.date = "Informe uma data válida.";
  } else {
    const hasDate = String(form.date ?? "").trim().length > 0;
    const hasMileageDue = String(form.mileageDue ?? "").trim().length > 0;

    if (!hasDate && !hasMileageDue) {
      errors.deadline = "Informe a data ou a quilometragem prevista.";
    }
    if (hasDate && !isValidDate(form.date)) {
      errors.date = "Informe uma data válida.";
    }
    if (hasMileageDue && !isNonNegativeInteger(form.mileageDue)) {
      errors.mileageDue = "Informe uma quilometragem inteira igual ou maior que zero.";
    }
  }

  if (!isCompleted && !String(form.description ?? "").trim()) {
    errors.description = "Informe a descrição do alerta.";
  }

  if (isCompleted && !isNonNegativeInteger(form.mileage)) {
    errors.mileage = "Informe uma quilometragem inteira igual ou maior que zero.";
  }
  if (isCompleted && !isValidMoney(form.value)) {
    errors.value = "Informe o valor da manutenção.";
  }

  for (const field of isCompleted ? fields : []) {
    const value = fieldValues[field.name];
    const errorKey = `payload.${field.name}`;
    const required = field.required || isConditionalFieldRequired(field, fieldValues);

    if (required && isEmptyDynamicValue(value)) {
      errors[errorKey] = `Informe ${field.label.toLowerCase()}.`;
      continue;
    }
    if (isEmptyDynamicValue(value)) continue;

    if (["number", "numeric", "decimal", "currency"].includes(field.type)
      && !Number.isFinite(Number(String(value).replace(",", ".")))) {
      errors[errorKey] = "Informe um número válido.";
    } else if (field.type === "integer" && !isNonNegativeInteger(value)) {
      errors[errorKey] = "Informe um número inteiro igual ou maior que zero.";
    } else if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      errors[errorKey] = "Informe uma data válida.";
    } else if (["select", "radio"].includes(field.type)
      && field.options.length > 0 && !field.options.includes(String(value))) {
      errors[errorKey] = "Selecione uma opção válida.";
    }
  }

  return errors;
}
