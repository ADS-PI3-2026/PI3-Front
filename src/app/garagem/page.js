"use client";

import {
  ArrowsLeftRightIcon,
  CalendarBlankIcon,
  CarIcon,
  CaretRightIcon,
  CircleNotchIcon,
  GaugeIcon,
  MotorcycleIcon,
  PencilSimpleIcon,
  PlusIcon,
  TruckIcon,
  UserCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthErrorMessage } from "../auth-api";
import AppShell, { useAuthUser } from "../components/app-shell";
import ExpenseSummary from "../components/expense-summary";
import NotificationMenu from "../components/notification-menu";
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
import { listMaintenanceDrafts } from "./_lib/maintenance-draft";
import { createVehicleDraftKey, readVehicleDraft } from "./_lib/vehicle-draft";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");
const UPCOMING_MAINTENANCE_DAYS = 7;

function formatMileage(value) {
  return mileageFormatter.format(value);
}

function getDaysUntilDate(value, referenceDate = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const reference = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  return Math.round((target - reference) / 86400000);
}

function getUpcomingDateDescription(days, dateLabel) {
  if (days === 0) return `Prevista para hoje (${dateLabel}).`;
  if (days === 1) return `Prevista para amanhã (${dateLabel}).`;
  return `Prevista para daqui a ${days} dias (${dateLabel}).`;
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
  return <AppShell desktopLayout><GarageContent /></AppShell>;
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
  const [compactHeader, setCompactHeader] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [maintenanceSummaries, setMaintenanceSummaries] = useState({});
  const [maintenanceDrafts, setMaintenanceDrafts] = useState([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState(null);
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(true);
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
  const visibleDrafts = useMemo(() => {
    const vehicleIds = new Set(requestState.vehicles.map((vehicle) => Number(vehicle.id)));
    return maintenanceDrafts.filter((draft) => vehicleIds.has(draft.vehicleId));
  }, [maintenanceDrafts, requestState.vehicles]);
  const activeNotifications = useMemo(() => {
    const notifications = [];

    if (pendingTransferCount > 0) {
      notifications.push({
        description: "Acompanhe, confirme ou cancele suas solicitações.",
        href: "/garagem/transferencia",
        id: "active-transfers",
        count: pendingTransferCount,
        title: `${pendingTransferCount} ${pendingTransferCount === 1
          ? "transferência em andamento"
          : "transferências em andamento"}`,
        tone: "success",
        type: "transfer",
      });
    }

    if (vehicleDraft && !registrationLimitReached) {
      notifications.push({
        count: 1,
        description: "Continue preenchendo os dados para adicionar o veículo à garagem.",
        href: "/garagem/novo",
        id: "new-vehicle-draft",
        title: "Cadastro de veículo em andamento",
        tone: "vehicle-draft",
        type: "vehicleDraft",
      });
    }

    for (const vehicle of requestState.vehicles) {
      const summary = maintenanceSummaries[vehicle.id];
      if (!summary) continue;

      if (summary.overdueCount > 0) {
        notifications.push({
          count: summary.overdueCount,
          description: `${vehicle.model} precisa da sua atenção. Abra os alertas para regularizar.`,
          href: `/garagem/${vehicle.id}?aba=a-realizar`,
          id: `overdue-maintenance-${vehicle.id}`,
          title: `${summary.overdueCount} ${summary.overdueCount === 1
            ? "manutenção atrasada"
            : "manutenções atrasadas"}`,
          tone: "danger",
          type: "overdue",
        });
      }

      const daysUntilMaintenance = getDaysUntilDate(summary.nextDate);
      if (daysUntilMaintenance !== null
        && daysUntilMaintenance >= 0
        && daysUntilMaintenance <= UPCOMING_MAINTENANCE_DAYS) {
        notifications.push({
          count: 1,
          description: `${vehicle.model}: ${getUpcomingDateDescription(
            daysUntilMaintenance,
            summary.nextDateLabel,
          )}`,
          href: `/garagem/${vehicle.id}?aba=a-realizar`,
          id: `upcoming-maintenance-${vehicle.id}`,
          title: "Manutenção próxima",
          tone: "upcoming",
          type: "upcoming",
        });
      }
    }

    const queuedDrafts = visibleDrafts.filter((draft) => draft.queued);
    const editableDrafts = visibleDrafts.filter((draft) => !draft.queued);

    for (const draft of [...queuedDrafts, ...editableDrafts]) {
      const vehicle = requestState.vehicles.find((item) => Number(item.id) === draft.vehicleId);
      const draftType = draft.form.status === "A realizar" ? "alerta" : "realizada";
      const queued = draft.queued === true;
      notifications.push({
        count: 1,
        description: queued
          ? `Abra o registro de ${vehicle?.model || "este veículo"} para concluir o envio.`
          : `Continue o preenchimento para ${vehicle?.model || "este veículo"}.`,
        href: `/garagem/${draft.vehicleId}/manutencao?tipo=${draftType}`,
        id: `maintenance-draft-${draft.vehicleId}`,
        title: queued ? "Registro aguardando sincronização" : "Rascunho de manutenção",
        tone: queued ? "sync" : "draft",
        type: queued ? "sync" : "draft",
      });
    }

    return notifications;
  }, [
    maintenanceSummaries,
    pendingTransferCount,
    registrationLimitReached,
    requestState.vehicles,
    vehicleDraft,
    visibleDrafts,
  ]);
  const activeNotificationCount = activeNotifications.reduce(
    (total, notification) => total + (notification.count ?? 1),
    0,
  );
  const maintenanceSummariesLoading = requestState.loading
    || requestState.vehicles.some((vehicle) => !Object.prototype.hasOwnProperty.call(
      maintenanceSummaries,
      vehicle.id,
    ));
  const notificationsLoading = pendingTransfersLoading
    || !draftsLoaded
    || maintenanceSummariesLoading;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1200px)");
    const updateHeader = () => {
      setCompactHeader(desktopQuery.matches && window.scrollY > 32);
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    desktopQuery.addEventListener("change", updateHeader);
    return () => {
      window.removeEventListener("scroll", updateHeader);
      desktopQuery.removeEventListener("change", updateHeader);
    };
  }, []);

  useEffect(() => {
    const refreshDrafts = () => {
      setMaintenanceDrafts(listMaintenanceDrafts(user.id));
      setVehicleDraft(readVehicleDraft(createVehicleDraftKey(user.id)));
      setDraftsLoaded(true);
    };
    const refreshVisibleDrafts = () => {
      if (!document.hidden) refreshDrafts();
    };

    refreshDrafts();
    window.addEventListener("focus", refreshDrafts);
    window.addEventListener("storage", refreshDrafts);
    document.addEventListener("visibilitychange", refreshVisibleDrafts);
    return () => {
      window.removeEventListener("focus", refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
      document.removeEventListener("visibilitychange", refreshVisibleDrafts);
    };
  }, [user.id]);

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
      setPendingTransfersLoading(true);
      try {
        const page = await listVehicleTransferPage(1);
        if (active) setPendingTransferCount(page.total);
      } catch {
        if (active) setPendingTransferCount(0);
      } finally {
        if (active) setPendingTransfersLoading(false);
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
      vehiclesToLoad.map((vehicle) => getVehicleMaintenanceDateSummary(
        vehicle.id,
        undefined,
        vehicle.mileage,
      )),
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
      <header className={`app-page-header ${styles.pageHeader} ${compactHeader ? styles.pageHeaderCompact : ""}`}>
        <div className={styles.headerIntroduction}>
          <h1 className="app-page-title">Olá, {firstName}</h1>
          <p>Acompanhe seus veículos, manutenções e gastos.</p>
        </div>
        <div className={styles.headerActions}>
          {showAddVehicleButton && (
            <button
              aria-label="Cadastrar / Transferir veículo"
              aria-controls="add-vehicle-menu"
              aria-expanded={addMenuOpen}
              aria-haspopup="dialog"
              className={`app-floating-action ${styles.addVehicleButton} ${addMenuOpen ? styles.addVehicleButtonOpen : ""}`}
              onClick={() => {
                setNotificationMenuOpen(false);
                setAddMenuOpen((open) => !open);
              }}
              type="button"
            >
              <PlusIcon aria-hidden size={28} weight="regular" />
              <span className={styles.addVehicleLabel}>Cadastrar / Transferir</span>
            </button>
          )}
          <Link className={styles.profileLink} href="/perfil">
            <UserCircleIcon aria-hidden size={23} weight="regular" />
            <span>Perfil</span>
          </Link>
          <NotificationMenu
            count={activeNotificationCount}
              loading={notificationsLoading}
            notifications={activeNotifications}
            onOpenChange={(open) => {
              setNotificationMenuOpen(open);
              if (open) setAddMenuOpen(false);
            }}
            open={notificationMenuOpen}
          />
        </div>

        {addMenuOpen && showAddVehicleButton && (
          <>
            <button
              aria-label="Fechar opções de veículo"
              className={styles.addMenuBackdrop}
              onClick={() => setAddMenuOpen(false)}
              type="button"
            />
            <div
              aria-label="Cadastro e transferências de veículos"
              className={styles.addVehicleMenu}
              id="add-vehicle-menu"
              role="dialog"
            >
              <header>
                <strong>Cadastro e transferências</strong>
                <span>Escolha como deseja continuar</span>
              </header>
              <Link href="/garagem/novo" onClick={() => setAddMenuOpen(false)}>
                <span className={styles.addMenuIcon}>
                  <CarIcon aria-hidden size={23} weight="duotone" />
                </span>
                <span className={styles.addMenuCopy}>
                  <span className={styles.addMenuTitleRow}>
                    <strong>Cadastrar novo</strong>
                    {vehicleDraft && (
                      <em className={styles.draftBadge}>
                        <PencilSimpleIcon aria-hidden size={12} weight="bold" />
                        Rascunho salvo
                      </em>
                    )}
                  </span>
                  <small>
                    {vehicleDraft
                      ? "Continuar o preenchimento salvo neste dispositivo"
                      : "Adicionar um veículo que ainda não possui histórico"}
                  </small>
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
      </header>

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

      <div className={styles.dashboardGrid}>
        <section aria-label="Resumo de gastos" className={styles.expenseSection}>
          <ExpenseSummary className={styles.expenseCard} />
        </section>

        <section aria-labelledby="vehicles-title" className={styles.vehiclesSection}>
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

        </section>
      </div>
    </>
  );
}
