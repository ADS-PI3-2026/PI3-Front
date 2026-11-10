import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterExpensesByVehicle,
  summarizeExpenses,
} from "../src/app/garagem/_lib/expense-summary.js";

const expenses = [
  { category: "Mecânica", cost: 350, serviceDate: "2026-11-01", vehicleId: 7 },
  { category: "Mecânica", cost: 150, serviceDate: "2026-10-15", vehicleId: 7 },
  { category: "Elétrica", cost: 200, serviceDate: "2025-11-03", vehicleId: 8 },
];

test("resume despesas do mês e agrupa as categorias", () => {
  assert.deepEqual(summarizeExpenses(expenses, "month", new Date(2026, 10, 3)), {
    categories: [{ category: "Mecânica", count: 1, total: 350 }],
    count: 1,
    total: 350,
  });
});

test("resume o ano e todo o período", () => {
  assert.deepEqual(summarizeExpenses(expenses, "year", new Date(2026, 10, 3)), {
    categories: [{ category: "Mecânica", count: 2, total: 500 }],
    count: 2,
    total: 500,
  });

  const completeSummary = summarizeExpenses(expenses, "all", new Date(2026, 10, 3));
  assert.equal(completeSummary.count, 3);
  assert.equal(completeSummary.total, 700);
  assert.deepEqual(completeSummary.categories, [
    { category: "Mecânica", count: 2, total: 500 },
    { category: "Elétrica", count: 1, total: 200 },
  ]);
});

test("filtra as despesas pelo veículo selecionado", () => {
  assert.deepEqual(filterExpensesByVehicle(expenses, "8"), [expenses[2]]);
  assert.deepEqual(filterExpensesByVehicle(expenses, "all"), expenses);
  assert.deepEqual(filterExpensesByVehicle(expenses, "invalid"), []);
});
