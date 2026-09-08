"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { expenseSummary, formatCurrency } from "../mock-data";
import styles from "./expense-summary.module.css";

export default function ExpenseSummary() {
  return (
    <section aria-labelledby="expense-title" className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 id="expense-title">Resumo de Gastos</h2>
      </div>

      <div className={styles.summaryGrid}>
        <div aria-label={`Total gasto: ${formatCurrency(expenseSummary.total)}`} className={styles.chartWrap}>
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie
                data={expenseSummary.categories}
                dataKey="value"
                endAngle={-270}
                innerRadius={60}
                isAnimationActive={false}
                outerRadius={82}
                startAngle={90}
                stroke="none"
              >
                {expenseSummary.categories.map((category) => (
                  <Cell fill={category.color} key={category.name} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.chartCenter}>
            <span>Total</span>
            <strong>R$ 3.2k</strong>
          </div>
        </div>

        <div className={styles.legend}>
          {expenseSummary.categories.map((category) => (
            <div className={styles.legendRow} key={category.name}>
              <span aria-hidden className={styles.legendDot} style={{ backgroundColor: category.color }} />
              <span className={styles.legendName}>{category.name}</span>
              <strong>{category.value}%</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.totalServices}>
        <span>Total de serviços</span>
        <strong>{expenseSummary.serviceCount}</strong>
      </div>
    </section>
  );
}
