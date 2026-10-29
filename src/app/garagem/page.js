"use client";

import { CircleNotch, Gauge, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthErrorMessage } from "../auth-api";
import AppShell, { useAuthUser } from "../components/app-shell";
import ExpenseSummary from "../components/expense-summary";
import VehicleBrandLogo from "../components/vehicle-brand-logo";
import VehiclePlate from "../components/vehicle-plate";
import { getCachedVehicles, listVehicles } from "./_lib/garage-api";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatMileage(value) {
  return mileageFormatter.format(value);
}

export default function GaragePage() {
  return <AppShell><GarageContent /></AppShell>;
}

function GarageContent() {
  const user = useAuthUser();
  const firstName = user.name.trim().split(/\s+/)[0];
  const [requestState, setRequestState] = useState(() => {
    const cached = getCachedVehicles();
    return { error: "", loading: cached === null, vehicles: cached ?? [] };
  });
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      try {
        const vehicles = await listVehicles();
        if (active) setRequestState({ error: "", loading: false, vehicles });
      } catch (error) {
        if (!active) return;
        setRequestState({
          error: getAuthErrorMessage(error, "Não foi possível carregar seus veículos. Tente novamente."),
          loading: false,
          vehicles: [],
        });
      }
    }

    void loadVehicles();
    return () => { active = false; };
  }, [retryRevision]);

  const retry = () => {
    setRequestState((current) => ({ ...current, error: "", loading: true }));
    setRetryRevision((revision) => revision + 1);
  };

  return (
    <>
      <header className={`app-page-header ${styles.pageHeader}`}>
        <h1 className="app-page-title">Olá, {firstName}</h1>
      </header>

      <div className={styles.dashboardGrid}>
        <section aria-labelledby="expense-title" className={styles.expenseSection}>
          <div className={styles.sectionHeader}>
            <h2 id="expense-title">Resumo de gastos</h2>
          </div>
          <ExpenseSummary />
        </section>

        <section aria-labelledby="vehicles-title" className={styles.vehiclesSection}>
          <div className={styles.sectionHeader}>
            <h2 id="vehicles-title">Meus veículos</h2>
          </div>

          <div aria-busy={requestState.loading} aria-live="polite" className={styles.vehicleList}>
            {requestState.loading ? (
              <div className={styles.loadingState} role="status">
                <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
                <span>Carregando seus veículos...</span>
              </div>
            ) : requestState.error ? (
              <div className={styles.requestState} role="alert">
                <h3>Não foi possível carregar a garagem</h3>
                <p>{requestState.error}</p>
                <button onClick={retry} type="button">Tentar novamente</button>
              </div>
            ) : requestState.vehicles.length === 0 ? (
              <div className={styles.requestState}>
                <h3>Sua garagem está vazia</h3>
                <p>Cadastre seu primeiro veículo para começar a registrar manutenções e alertas.</p>
              </div>
            ) : requestState.vehicles.map((vehicle) => (
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
                    <div className={styles.vehicleCopy}>
                      <h3>{vehicle.model}</h3>
                      <div className={styles.vehicleDetails}>
                        <span>{vehicle.brand}</span>
                        <span>{vehicle.version}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.mileage}>
                  <span className={styles.mileageValue}>
                    <Gauge aria-hidden size={21} weight="regular" />
                    <span>{formatMileage(vehicle.mileage)} km</span>
                  </span>
                  <VehiclePlate plate={vehicle.plate} />
                </div>

                <div className={styles.maintenanceHeader}>
                  <span>Próxima manutenção</span>
                  <strong className={styles.info}>Alertas em breve</strong>
                </div>
                <div aria-hidden className={styles.progressTrack}>
                  <span className={styles.progressInfo} style={{ width: "0%" }} />
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
    </>
  );
}
