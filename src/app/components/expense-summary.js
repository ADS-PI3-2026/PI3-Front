"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthErrorMessage } from "../auth-api";
import { listMaintenanceExpenses, listVehicles } from "../garagem/_lib/garage-api";
import {
  expensePeriods,
  filterExpensesByVehicle,
  summarizeExpenses,
} from "../garagem/_lib/expense-summary";
import styles from "./expense-summary.module.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const chartColors = [
  "#0759a8",
  "#2f80d1",
  "#54a8e8",
  "#36a879",
  "#f2a93b",
  "#e06c75",
  "#8c6ccf",
  "#748095",
];

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export default function ExpenseSummary() {
  const detailsRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState("year");
  const [requestState, setRequestState] = useState({ error: "", loading: true });
  const [retryRevision, setRetryRevision] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState("all");
  const [vehicles, setVehicles] = useState([]);
  const filteredExpenses = useMemo(
    () => filterExpensesByVehicle(expenses, selectedVehicleId),
    [expenses, selectedVehicleId],
  );
  const summary = useMemo(
    () => summarizeExpenses(filteredExpenses, period),
    [filteredExpenses, period],
  );
  const periodLabel = expensePeriods.find((item) => item.value === period)?.label ?? "Período";
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle.id) === selectedVehicleId);
  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.plate} · ${selectedVehicle.name}`
    : "todos os veículos";
  const chartCategories = useMemo(() => (
    summary.categories.map((category, index, categories) => {
      const percentage = summary.total > 0 ? (category.total / summary.total) * 100 : 0;
      const offset = summary.total > 0
        ? categories
            .slice(0, index)
            .reduce((total, item) => total + ((item.total / summary.total) * 100), 0)
        : 0;

      return {
        ...category,
        color: chartColors[index % chartColors.length],
        offset,
        percentage,
      };
    })
  ), [summary]);

  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = window.matchMedia("(min-width: 760px)").matches;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadExpenses() {
      setRequestState({ error: "", loading: true });
      try {
        const [loadedExpenses, loadedVehicles] = await Promise.all([
          listMaintenanceExpenses(),
          listVehicles(),
        ]);
        if (active) {
          setExpenses(loadedExpenses);
          setVehicles(loadedVehicles);
          setRequestState({ error: "", loading: false });
        }
      } catch (error) {
        if (active) {
          setRequestState({
            error: getAuthErrorMessage(
              error,
              "Não foi possível carregar o resumo de gastos. Tente novamente.",
            ),
            loading: false,
          });
        }
      }
    }

    void loadExpenses();
    return () => { active = false; };
  }, [retryRevision]);

  return (
    <details className={`app-card ${styles.card}`} ref={detailsRef}>
      <summary
        aria-label={`Ver resumo de gastos de ${vehicleLabel}, no período: ${periodLabel.toLowerCase()}`}
        className={styles.trigger}
      >
        <strong>Ver resumo de gastos</strong>
        <CaretDown aria-hidden className={styles.chevron} size={22} weight="bold" />
      </summary>

      <div className={styles.detailsContent}>
        <h3 className={styles.detailsTitle}>Resumo de gastos da garagem</h3>

        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>Período</span>
            <select disabled={requestState.loading} onChange={(event) => setPeriod(event.target.value)} value={period}>
              {expensePeriods.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>Veículo</span>
            <select
              disabled={requestState.loading}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
              value={selectedVehicleId}
            >
              <option value="all">Todos os veículos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {requestState.loading ? (
          <div className={styles.requestState} role="status">
            <strong>Calculando seus gastos...</strong>
          </div>
        ) : requestState.error ? (
          <div className={styles.requestState} role="alert">
            <strong>Não foi possível carregar o resumo</strong>
            <p>{requestState.error}</p>
            <button onClick={() => setRetryRevision((revision) => revision + 1)} type="button">
              Tentar novamente
            </button>
          </div>
        ) : summary.count === 0 ? (
          <div className={styles.requestState} role="status">
            <strong>Nenhuma despesa neste período</strong>
            <p>Os valores aparecerão aqui quando houver manutenções para os filtros selecionados</p>
          </div>
        ) : (
          <>
            <dl className={styles.summaryGrid}>
              <div>
                <dt>Serviços realizados</dt>
                <dd>{summary.count}</dd>
              </div>
              <div>
                <dt>Total no período</dt>
                <dd>{formatCurrency(summary.total)}</dd>
              </div>
            </dl>

            <section className={styles.categorySection}>
              <h4>Gastos por tipo de manutenção</h4>

              <div className={styles.chartGrid}>
                <div
                  aria-label={`Gráfico de gastos por tipo de manutenção. Total: ${formatCurrency(summary.total)}.`}
                  className={styles.chartWrap}
                  role="img"
                >
                  <svg aria-hidden className={styles.chart} viewBox="0 0 40 40">
                    <circle className={styles.chartBackground} cx="20" cy="20" r="15.9155" />
                    {chartCategories.map((category) => (
                      <circle
                        className={styles.chartSegment}
                        cx="20"
                        cy="20"
                        key={category.category}
                        r="15.9155"
                        stroke={category.color}
                        strokeDasharray={`${category.percentage} ${100 - category.percentage}`}
                        strokeDashoffset={-category.offset}
                      />
                    ))}
                  </svg>

                  <div className={styles.chartCenter}>
                    <span>Total</span>
                    <strong>{formatCurrency(summary.total)}</strong>
                  </div>
                </div>

                <ul className={styles.legend}>
                  {chartCategories.map((category) => (
                    <li key={category.category}>
                      <span
                        aria-hidden
                        className={styles.legendDot}
                        style={{ backgroundColor: category.color }}
                      />
                      <span className={styles.legendDescription}>
                        <strong>{category.category}</strong>
                        <small>{category.count} {category.count === 1 ? "serviço" : "serviços"}</small>
                      </span>
                      <span className={styles.legendValue}>
                        <strong>{formatCurrency(category.total)}</strong>
                        <small>{category.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </details>
  );
}
