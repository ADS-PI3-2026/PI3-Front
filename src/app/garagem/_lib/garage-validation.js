import { validarRenavam } from "../../lib/form-validation";

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

export function isValidDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ""));
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

export function isValidMoney(value) {
  const normalized = String(value ?? "").trim().replace(/^R$\s*/, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return false;
  return Number.isFinite(Number(normalized)) && Number(normalized) >= 0;
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
  } else if (!isPositiveInteger(mileage)) {
    errors.mileage = "A quilometragem deve ser maior que zero.";
  }

  return errors;
}

export function validateMaintenanceForm(form) {
  const errors = {};
  const isCompleted = form.status === "Realizada";

  if (!form.status) errors.status = "Selecione o status do serviço.";
  if (!form.category) errors.category = "Selecione uma categoria.";
  if (!isValidDate(form.date)) errors.date = "Informe uma data válida em dd/mm/aaaa.";
  if (!form.description.trim()) errors.description = "Descreva o serviço.";

  if (isCompleted && !isPositiveInteger(form.mileage)) {
    errors.mileage = "Informe a quilometragem registrada na realização.";
  }
  if (isCompleted && !isValidMoney(form.value)) {
    errors.value = "Informe o valor da manutenção.";
  }

  return errors;
}
