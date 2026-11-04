import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeExpenses } from "../src/app/garagem/_lib/expense-summary.js";

const expenses = [
  { category: "Mecânica", cost: 350, serviceDate: "2026-11-01" },
  { category: "Mecânica", cost: 150, serviceDate: "2026-10-15" },
  { category: "Elétrica", cost: 200, serviceDate: "2025-11-03" },
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
