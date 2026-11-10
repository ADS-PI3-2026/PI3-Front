"use client";

import {
  ArrowsLeftRightIcon,
  CalendarBlankIcon,
  CarIcon,
  CaretRightIcon,
  CircleNotchIcon,
  GaugeIcon,
  MotorcycleIcon,
  PlusIcon,
  TruckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAuthErrorMessage } from "../auth-api";
import AppShell, { useAuthUser } from "../components/app-shell";
import ExpenseSummary from "../components/expense-summary";
import VehicleBrandLogo from "../components/vehicle-brand-logo";
import VehiclePlate from "../components/vehicle-plate";
import VehicleRegistrationLimit from "./_components/vehicle-registration-limit";
import {
  getCachedVehiclePage,
  getVehicleMaintenanceDateSummary,
  listVehicleTransferPage,
  listVehiclePage,
} from "./_lib/garage-api";
import {
  getRemainingVehicleRegistrations,
  hasReachedVehicleRegistrationLimit,
  MAX_DIRECT_VEHICLE_REGISTRATIONS,
} from "./_lib/vehicle-registration-limit";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatMileage(value) {
  return mileageFormatter.format(value);
}

function VehicleTypeIcon({ type }) {
  const vehicleTypes = {
    cars: { icon: CarIcon, label: "Automóvel" },
    motorcycles: { icon: MotorcycleIcon, label: "Motocicleta" },
    trucks: { icon: TruckIcon, label: "Caminhão" },
  };
  const vehicleType = vehicleTypes[type] ?? vehicleTypes.cars;
  const Icon = vehicleType.icon;

  return (
    <span
      aria-label={`Tipo do veículo: ${vehicleType.label}`}
      className={styles.vehicleTypeIcon}
      role="img"
    >
      <Icon aria-hidden size={29} weight="duotone" />
    </span>
  );
}

export default function GaragePage() {
  return <AppShell><GarageContent /></AppShell>;
}

function GarageContent() {
  const user = useAuthUser();
  const firstName = user.name.trim().split(/\s+/)[0];
  const [requestState, setRequestState] = useState(() => {
    const cached = getCachedVehiclePage();
    return {
      error: "",
      hasMore: cached?.hasMore ?? false,
      loadMoreError: "",
      loading: cached === null,
      loadingMore: false,
      page: cached?.page ?? 1,
      total: cached?.total ?? cached?.items.length ?? 0,
      vehicles: cached?.items ?? [],
    };
  });
  const [retryRevision, setRetryRevision] = useState(0);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [maintenanceSummaries, setMaintenanceSummaries] = useState({});
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const requestedSummaryIds = useRef(new Set());
  const mounted = useRef(true);
  const remainingRegistrations = getRemainingVehicleRegistrations(requestState.total);
  const registrationLimitReached = !requestState.loading
    && !requestState.error
    && hasReachedVehicleRegistrationLimit(requestState.total);
  const showRemainingRegistrations = !requestState.loading
    && !requestState.error
    && remainingRegistrations > 0
    && remainingRegistrations < MAX_DIRECT_VEHICLE_REGISTRATIONS;
  const showAddVehicleButton = !requestState.loading
    && !requestState.error
    && !registrationLimitReached;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      try {
        const vehiclePage = await listVehiclePage(1);
        if (active) {
          setRequestState({
            error: "",
            hasMore: vehiclePage.hasMore,
            loadMoreError: "",
            loading: false,
            loadingMore: false,
            page: vehiclePage.page,
            total: vehiclePage.total,
            vehicles: vehiclePage.items,
          });
        }
      } catch (error) {
        if (!active) return;
        setRequestState({
          error: getAuthErrorMessage(error, "Não foi possível carregar seus veículos. Tente novamente."),
          hasMore: false,
          loadMoreError: "",
          loading: false,
          loadingMore: false,
          page: 1,
          total: 0,
          vehicles: [],
        });
      }
    }

    void loadVehicles();
    return () => { active = false; };
  }, [retryRevision]);

  useEffect(() => {
    let active = true;

    async function loadPendingTransferCount() {
      try {
        const page = await listVehicleTransferPage(1);
        if (active) setPendingTransferCount(page.total);
      } catch {
        if (active) setPendingTransferCount(0);
      }
    }

    void loadPendingTransferCount();
    return () => { active = false; };
  }, [retryRevision]);

  useEffect(() => {
    const vehiclesToLoad = requestState.vehicles.filter(
      (vehicle) => !requestedSummaryIds.current.has(vehicle.id),
    );
    if (vehiclesToLoad.length === 0) return;

    for (const vehicle of vehiclesToLoad) requestedSummaryIds.current.add(vehicle.id);

    void Promise.allSettled(
      vehiclesToLoad.map((vehicle) => getVehicleMaintenanceDateSummary(vehicle.id)),
    ).then((results) => {
      if (!mounted.current) return;
      setMaintenanceSummaries((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          next[vehiclesToLoad[index].id] = result.status === "fulfilled" ? result.value : null;
        });
        return next;
      });
    });
  }, [requestState.vehicles]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [addMenuOpen]);

  const retry = () => {
    setRequestState((current) => ({ ...current, error: "", loading: true }));
    setRetryRevision((revision) => revision + 1);
  };

  const loadMoreVehicles = async () => {
    if (requestState.loadingMore || !requestState.hasMore) return;
    setRequestState((current) => ({ ...current, loadMoreError: "", loadingMore: true }));

    try {
      const nextPage = await listVehiclePage(requestState.page + 1);
      setRequestState((current) => {
        const knownIds = new Set(current.vehicles.map((vehicle) => vehicle.id));
        const newVehicles = nextPage.items.filter((vehicle) => !knownIds.has(vehicle.id));
        return {
          ...current,
          hasMore: nextPage.hasMore,
          loadingMore: false,
          page: nextPage.page,
          total: nextPage.total,
          vehicles: [...current.vehicles, ...newVehicles],
        };
      });
    } catch (error) {
      setRequestState((current) => ({
        ...current,
        loadMoreError: getAuthErrorMessage(
          error,
          "Não foi possível carregar mais veículos. Tente novamente.",
        ),
        loadingMore: false,
      }));
    }
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
          {pendingTransferCount > 0 && (
            <Link className={styles.transferNotice} href="/garagem/transferencia">
              <span className={styles.transferNoticeIcon}>
                <ArrowsLeftRightIcon aria-hidden size={24} weight="duotone" />
              </span>
              <span>
                <strong>
                  {pendingTransferCount} {pendingTransferCount === 1
                    ? "transferência em andamento"
                    : "transferências em andamento"}
                </strong>
                <small>Acompanhe, confirme ou cancele suas solicitações</small>
              </span>
              <CaretRightIcon aria-hidden size={19} weight="bold" />
            </Link>
          )}

          <div className={styles.sectionHeader}>
            <h2 id="vehicles-title">Meus veículos</h2>
          </div>

          <div aria-busy={requestState.loading || requestState.loadingMore} aria-live="polite" className={styles.vehicleList}>
            {requestState.loading ? (
              <div className={styles.loadingState} role="status">
                <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
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
                <p>Cadastre seu primeiro veículo para começar a registrar manutenções e alertas</p>
              </div>
            ) : (
              <>
                {requestState.vehicles.map((vehicle) => (
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
                        </div>
                      </div>
                      <VehicleTypeIcon type={vehicle.type} />
                    </div>

                    <div className={styles.vehicleOverview}>
                      <div className={styles.vehicleMetadata}>
                        <strong>{vehicle.brand}</strong>
                        <span>{vehicle.version}</span>
                        <span className={styles.mileageValue}>
                          <GaugeIcon aria-hidden size={19} weight="regular" />
                          <span>{formatMileage(vehicle.mileage)} km</span>
                        </span>
                      </div>
                      <VehiclePlate plate={vehicle.plate} type={vehicle.type} />
                    </div>

                    {(maintenanceSummaries[vehicle.id]?.nextDateLabel
                      || maintenanceSummaries[vehicle.id]?.overdueCount > 0) && (
                      <div className={styles.maintenanceSummary}>
                        {maintenanceSummaries[vehicle.id].nextDateLabel && (
                          <div className={styles.maintenanceRow}>
                            <span>
                              <CalendarBlankIcon aria-hidden size={17} weight="duotone" />
                              Próxima manutenção
                            </span>
                            <strong>{maintenanceSummaries[vehicle.id].nextDateLabel}</strong>
                          </div>
                        )}
                        {maintenanceSummaries[vehicle.id].overdueCount > 0 && (
                          <div className={`${styles.maintenanceRow} ${styles.overdueRow}`}>
                            <span>
                              <WarningCircleIcon aria-hidden size={17} weight="fill" />
                              Manutenções atrasadas
                            </span>
                            <strong>
                              {maintenanceSummaries[vehicle.id].overdueCount}{" "}
                              {maintenanceSummaries[vehicle.id].overdueCount === 1 ? "atrasada" : "atrasadas"}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </Link>
                ))}

                {requestState.loadMoreError && (
                  <p className={styles.loadMoreError} role="alert">{requestState.loadMoreError}</p>
                )}

                {requestState.hasMore && (
                  <button
                    className={styles.loadMoreButton}
                    disabled={requestState.loadingMore}
                    onClick={() => void loadMoreVehicles()}
                    type="button"
                  >
                    {requestState.loadingMore && (
                      <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />
                    )}
                    {requestState.loadingMore ? "Carregando..." : "Carregar mais veículos"}
                  </button>
                )}
              </>
            )}
          </div>

          {showRemainingRegistrations && (
            <p className={styles.registrationAvailability}>
              Você ainda pode cadastrar {remainingRegistrations}{" "}
              {remainingRegistrations === 1 ? "veículo" : "veículos"} diretamente.
            </p>
          )}

          {registrationLimitReached && <VehicleRegistrationLimit />}

          {addMenuOpen && showAddVehicleButton && (
            <>
              <button
                aria-label="Fechar opções de veículo"
                className={styles.addMenuBackdrop}
                onClick={() => setAddMenuOpen(false)}
                type="button"
              />
              <div
                aria-label="Opções para adicionar veículo"
                className={styles.addVehicleMenu}
                id="add-vehicle-menu"
                role="dialog"
              >
                <header>
                  <strong>Adicionar veículo</strong>
                  <span>Escolha como deseja continuar</span>
                </header>
                <Link href="/garagem/novo" onClick={() => setAddMenuOpen(false)}>
                  <span className={styles.addMenuIcon}>
                    <CarIcon aria-hidden size={23} weight="duotone" />
                  </span>
                  <span>
                    <strong>Cadastrar novo</strong>
                    <small>Adicionar um veículo que ainda não possui histórico</small>
                  </span>
                  <CaretRightIcon aria-hidden size={18} weight="bold" />
                </Link>
                <Link href="/garagem/transferencia" onClick={() => setAddMenuOpen(false)}>
                  <span className={styles.addMenuIcon}>
                    <ArrowsLeftRightIcon aria-hidden size={23} weight="duotone" />
                  </span>
                  <span>
                    <strong>Transferências</strong>
                    <small>Acompanhar solicitações ou transferir um veículo existente</small>
                  </span>
                  <CaretRightIcon aria-hidden size={18} weight="bold" />
                </Link>
              </div>
            </>
          )}

          {showAddVehicleButton && (
            <button
              aria-label="Adicionar veículo"
              aria-controls="add-vehicle-menu"
              aria-expanded={addMenuOpen}
              className={`app-floating-action ${styles.addVehicleButton} ${addMenuOpen ? styles.addVehicleButtonOpen : ""}`}
              onClick={() => setAddMenuOpen((open) => !open)}
              type="button"
            >
              <PlusIcon aria-hidden size={28} weight="regular" />
            </button>
          )}
        </section>
      </div>
    </>
  );
}
