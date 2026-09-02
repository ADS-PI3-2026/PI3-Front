"use client";

import { Gauge, Plus } from "@phosphor-icons/react";
import AppShell from "../components/app-shell";
import ExpenseSummary from "../components/expense-summary";
import { formatMileage, mockUser, mockVehicles } from "../mock-data";
import styles from "./page.module.css";

export default function GaragePage() {
  const firstName = mockUser.name.split(" ")[0];

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <h1>Olá, {firstName}</h1>
      </header>

      <div className={styles.dashboardGrid}>
        <ExpenseSummary />

        <section aria-labelledby="vehicles-title" className={styles.vehiclesSection}>
          <div className={styles.sectionHeader}>
            <h2 id="vehicles-title">Meus veículos</h2>
          </div>

          <div className={styles.vehicleList}>
            {mockVehicles.map((vehicle) => (
              <article className={styles.vehicleCard} key={vehicle.id}>
                <div className={styles.vehicleHeading}>
                  <div>
                    <h3>{vehicle.name}</h3>
                    <p>{vehicle.version}</p>
                  </div>
                  <span className={styles.plate}>{vehicle.plate}</span>
                </div>

                <div className={styles.mileage}>
                  <Gauge aria-hidden size={21} weight="regular" />
                  <span>{formatMileage(vehicle.mileage)} km</span>
                </div>

                <div className={styles.maintenanceHeader}>
                  <span>{vehicle.nextMaintenance.label}</span>
                  <strong className={vehicle.nextMaintenance.tone === "danger" ? styles.danger : styles.info}>
                    {vehicle.nextMaintenance.status}
                  </strong>
                </div>
                <div aria-hidden className={styles.progressTrack}>
                  <span
                    className={vehicle.nextMaintenance.tone === "danger" ? styles.progressDanger : styles.progressInfo}
                    style={{ width: `${vehicle.nextMaintenance.progress}%` }}
                  />
                </div>
              </article>
            ))}
          </div>

          <button
            aria-label="Adicionar veículo — disponível na próxima etapa"
            className={styles.addVehicleButton}
            disabled
            title="Disponível na próxima etapa"
            type="button"
          >
            <Plus aria-hidden size={28} weight="regular" />
          </button>
        </section>
      </div>
    </AppShell>
  );
}
