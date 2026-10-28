import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCurrencyInput,
  isValidDate,
  isValidMoney,
  toDateInputValue,
  validateMaintenanceForm,
  validateVehicleForm,
} from "../src/app/garagem/_lib/garage-validation.js";

const validForm = {
  type: "cars",
  brand: "56",
  model: "1234",
  year: "2024-1",
  color: "Prata",
  plate: "ABC1D23",
  renavam: "12345678900",
  mileage: "0",
};

test("veículo aceita quilometragem zero e RENAVAM com 9 ou 11 dígitos", () => {
  assert.deepEqual(validateVehicleForm(validForm), {});
  assert.deepEqual(validateVehicleForm({ ...validForm, renavam: "123456789" }), {});
  assert.match(validateVehicleForm({ ...validForm, color: "" }).color, /cor/);
  assert.match(validateVehicleForm({ ...validForm, renavam: "1234567890" }).renavam, /9 ou 11 dígitos/);
  assert.match(validateVehicleForm({ ...validForm, renavam: "123456788" }).renavam, /válido/);
});

test("manutenção valida os campos fixos e dinâmicos exigidos pelo backend", () => {
  const form = {
    status: "Realizada",
    category: "troca-oleo-filtros",
    mileage: "0",
    date: "24/10/2026",
    description: "",
    value: "0,00",
  };
  const fields = [
    { name: "oil_brand", label: "Marca do óleo", required: true, requiredIfFieldFilled: "", type: "text", options: [] },
    { name: "filter_changed", label: "Filtro trocado", required: true, requiredIfFieldFilled: "", type: "boolean", options: [] },
    { name: "filter_brand", label: "Marca do filtro", required: false, requiredIfFieldFilled: "filter_changed", type: "text", options: [] },
  ];

  assert.deepEqual(validateMaintenanceForm(form, fields, {
    oil_brand: "Mobil",
    filter_changed: "false",
  }), {});

  const errors = validateMaintenanceForm(form, fields, {
    oil_brand: "",
    filter_changed: "true",
    filter_brand: "",
  });
  assert.match(errors["payload.oil_brand"], /marca do óleo/i);
  assert.match(errors["payload.filter_brand"], /marca do filtro/i);
});

test("data nativa e valor monetário formatado são aceitos no cadastro", () => {
  assert.equal(isValidDate("2026-10-24"), true);
  assert.equal(isValidDate("2026-02-31"), false);
  assert.equal(toDateInputValue("24/10/2026"), "2026-10-24");

  let value = formatCurrencyInput("1");
  assert.equal(value, "R$ 0,01");
  value = formatCurrencyInput(`${value}2`, value);
  assert.equal(value, "R$ 0,12");
  value = formatCurrencyInput("", value, true);
  assert.equal(value, "R$ 0,01");
  assert.equal(isValidMoney("R$ 1.234,56"), true);
});

test("alerta exige categoria, descrição e ao menos um prazo", () => {
  const form = {
    status: "A realizar",
    category: "troca-oleo-filtros",
    mileage: "",
    mileageDue: "",
    date: "2026-12-10",
    description: "Realizar a próxima troca preventiva.",
    value: "",
  };
  const fields = [{
    name: "oil_brand",
    label: "Marca do óleo",
    required: true,
    requiredIfFieldFilled: "",
    type: "text",
    options: [],
  }];

  assert.deepEqual(validateMaintenanceForm(form, fields, {}), {});
  assert.match(validateMaintenanceForm({ ...form, description: "" }, fields, {}).description, /descrição/);
  assert.match(validateMaintenanceForm({ ...form, date: "" }, fields, {}).deadline, /data ou a quilometragem/);
  assert.deepEqual(validateMaintenanceForm({ ...form, date: "", mileageDue: "50000" }, fields, {}), {});
  assert.deepEqual(validateMaintenanceForm({ ...form, mileageDue: "50000" }, fields, {}), {});
  assert.match(
    validateMaintenanceForm({ ...form, date: "", mileageDue: "50,5" }, fields, {}).mileageDue,
    /inteira/,
  );
});
