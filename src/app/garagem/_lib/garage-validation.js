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

  if (!form.type) errors.type = "Selecione o tipo de veículo.";
  if (!form.brand) errors.brand = "Selecione a marca.";
  if (!form.model) errors.model = "Selecione o modelo.";
  if (!form.year) errors.year = "Selecione o ano/modelo.";
  if (!form.plate.trim()) errors.plate = "Informe a placa.";
  else if (!isValidPlate(form.plate)) errors.plate = "Use uma placa válida: ABC-1234 ou ABC1D23.";
  if (!isPositiveInteger(form.mileage)) errors.mileage = "Informe a quilometragem inicial.";
  if (!form.documentName) errors.documentName = "Anexe o documento CRLV.";

  return errors;
}

export function validateMaintenanceForm(form) {
  const errors = {};

  if (!form.status) errors.status = "Selecione o status do serviço.";
  if (!form.category) errors.category = "Selecione uma categoria.";
  if (!isPositiveInteger(form.mileage)) errors.mileage = "Informe a quilometragem.";
  if (!isValidDate(form.date)) errors.date = "Informe uma data válida em dd/mm/aaaa.";
  if (!form.description.trim()) errors.description = "Descreva o serviço.";
  if (form.status === "Realizada" && !isValidMoney(form.value)) errors.value = "Informe o valor da manutenção.";
  if (form.status === "A realizar" && form.value.trim() && !isValidMoney(form.value)) errors.value = "Informe um valor válido.";

  return errors;
}
