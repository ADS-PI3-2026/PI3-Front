export const expensePeriods = [
  { label: "Este mês", value: "month" },
  { label: "Este ano", value: "year" },
  { label: "Todo o período", value: "all" },
];

export function filterExpensesByVehicle(expenses, vehicleId = "all") {
  if (!Array.isArray(expenses)) return [];
  if (vehicleId === "all") return expenses;

  const selectedVehicleId = Number(vehicleId);
  if (!Number.isInteger(selectedVehicleId) || selectedVehicleId <= 0) return [];
  return expenses.filter((expense) => Number(expense?.vehicleId) === selectedVehicleId);
}

function isInPeriod(serviceDate, period, referenceDate) {
  if (period === "all") return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(serviceDate ?? ""));
  if (!match) return false;

  const year = String(referenceDate.getFullYear());
  if (match[1] !== year) return false;
  if (period === "year") return true;

  return match[2] === String(referenceDate.getMonth() + 1).padStart(2, "0");
}

export function summarizeExpenses(expenses, period = "year", referenceDate = new Date()) {
  const validExpenses = Array.isArray(expenses)
    ? expenses.filter((expense) => isInPeriod(expense.serviceDate, period, referenceDate))
    : [];
  const categoryMap = new Map();
  let total = 0;

  for (const expense of validExpenses) {
    const cost = Number(expense.cost);
    if (!Number.isFinite(cost) || cost < 0) continue;
    const category = String(expense.category || "Outros").trim() || "Outros";
    const current = categoryMap.get(category) ?? { category, count: 0, total: 0 };
    current.count += 1;
    current.total += cost;
    categoryMap.set(category, current);
    total += cost;
  }

  return {
    categories: Array.from(categoryMap.values()).sort((left, right) => (
      right.total - left.total || left.category.localeCompare(right.category, "pt-BR")
    )),
    count: validExpenses.length,
    total,
  };
}
