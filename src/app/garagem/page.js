"use client";

import { Gauge, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import AppShell from "../components/app-shell";
import ExpenseSummary from "../components/expense-summary";
import VehicleBrandLogo from "../components/vehicle-brand-logo";
import VehiclePlate from "../components/vehicle-plate";
import { formatMileage, mockUser, mockVehicles } from "../mock-data";
import styles from "./page.module.css";

export default function GaragePage() {
  const firstName = mockUser.name.split(" ")[0];

  return (
    <AppShell>
      <header className={`app-page-header ${styles.pageHeader}`}>
        <h1 className="app-page-title">Olá, {firstName}</h1>
      </header>

      <div className={styles.dashboardGrid}>
        <ExpenseSummary />

        <section aria-labelledby="vehicles-title" className={styles.vehiclesSection}>
          <div className={styles.sectionHeader}>
            <h2 id="vehicles-title">Meus veículos</h2>
          </div>

          <div className={styles.vehicleList}>
            {mockVehicles.map((vehicle) => (
              <Link
                aria-label={"Abrir histórico de " + vehicle.name}
                className={`app-card ${styles.vehicleCard}`}
                href={"/garagem/" + vehicle.id}
                key={vehicle.id}
              >
                <div className={styles.vehicleHeading}>
                  <div className={styles.vehicleIdentity}>
                    <VehicleBrandLogo
                      brandId={vehicle.brandId}
                      className={styles.brandLogo}
                      type={vehicle.type}
                    />
                    <div>
                      <h3>{vehicle.name}</h3>
                      <p>{vehicle.version}</p>
                    </div>
                  </div>
                  <VehiclePlate plate={vehicle.plate} />
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
                    style={{ width: vehicle.nextMaintenance.progress + "%" }}
                  />
                </div>
              </Link>
            ))}
          </div>

          <Link
            aria-label="Adicionar veículo"
            className={`app-floating-action ${styles.addVehicleButton}`}
            href="/garagem/novo"
          >
            <Plus aria-hidden size={28} weight="regular" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
