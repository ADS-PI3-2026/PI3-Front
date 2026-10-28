"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellRinging,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  FilePdf,
  Gauge,
  LockKey,
  Eye,
  PencilSimple,
  Plus,
  GearSix,
  WarningCircle,
  Wrench,
  ClockCounterClockwiseIcon,
  CardsIcon,
} from "@phosphor-icons/react";
import AppShell from "../../components/app-shell";
import SegmentedControl from "../../components/segmented-control";
import VehicleBrandLogo from "../../components/vehicle-brand-logo";
import VehiclePlate from "../../components/vehicle-plate";
import PageTopBar from "../_components/page-top-bar";
import {
  getVehicle,
  listVehicleAlerts,
  listVehicleMaintenances,
} from "../_lib/garage-api";
import { getAuthErrorMessage } from "../../auth-api";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatMileage(value) {
  return mileageFormatter.format(value);
}

function getAlertTone(item) {
  return item.status === "Atrasada" ? styles.overdue : styles.pending;
}

export default function VehicleHistoryPage() {
  const params = useParams();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [selectedView, setSelectedView] = useState("history");
  const [retryRevision, setRetryRevision] = useState(0);
  const [requestState, setRequestState] = useState({
    alerts: [],
    error: "",
    loading: true,
    maintenances: [],
    notFound: false,
    vehicle: null,
  });

  useEffect(() => {
    let active = true;

    async function loadVehicleHistory() {
      setRequestState((current) => ({
        ...current,
        error: "",
        loading: true,
        notFound: false,
      }));

      try {
        const loadedVehicle = await getVehicle(vehicleId);
        const [maintenances, alerts] = await Promise.all([
          listVehicleMaintenances(vehicleId),
          listVehicleAlerts(vehicleId, loadedVehicle.mileage),
        ]);

        if (active) {
          setRequestState({
            alerts,
            error: "",
            loading: false,
            maintenances,
            notFound: false,
            vehicle: loadedVehicle,
          });
        }
      } catch (error) {
        if (!active) return;
        setRequestState({
          alerts: [],
          error: getAuthErrorMessage(
            error,
            "Não foi possível carregar os dados do veículo. Tente novamente.",
          ),
          loading: false,
          maintenances: [],
          notFound: error?.status === 404,
          vehicle: null,
        });
      }
    }

    void loadVehicleHistory();
    return () => { active = false; };
  }, [retryRevision, vehicleId]);

  const changeView = (nextView) => {
    setSelectedView(nextView);
  };

  if (requestState.loading) {
    return (
      <AppShell>
        <PageTopBar title="Manutenções" />
        <section className={styles.loadingState} role="status">
          <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
          <span>Carregando dados do veículo...</span>
        </section>
      </AppShell>
    );
  }

  if (!requestState.vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Manutenções" />
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>{requestState.notFound ? "Veículo não encontrado" : "Não foi possível carregar o veículo"}</h2>
          <p>
            {requestState.notFound
              ? "Volte para a garagem e selecione um veículo cadastrado."
              : requestState.error}
          </p>
          {requestState.notFound ? (
            <Link className="app-empty-link" href="/garagem">Ir para garagem</Link>
          ) : (
            <button
              className="app-empty-link"
              onClick={() => setRetryRevision((revision) => revision + 1)}
              type="button"
            >
              Tentar novamente
            </button>
          )}
        </section>
      </AppShell>
    );
  }

  const { alerts: alertItems, maintenances: maintenanceItems, vehicle } = requestState;

  const viewOptions = [
    {
      label: `Histórico (${maintenanceItems.length})`,
      value: "history",
    },
    {
      label: `Manutenções (${alertItems.length})`,
      value: "alerts",
    },
  ];

  return (
    <AppShell>
      <PageTopBar title="Manutenções" />

      <section className={styles.vehicleHero}>
        <div className={styles.vehicleTitle}>
          <VehicleBrandLogo
            brandId={vehicle.brandId}
            className={styles.brandLogo}
            type={vehicle.type}
          />
          <div className={styles.vehicleTitleCopy}>
            <h2>{vehicle.model}</h2>
            <div className={styles.vehicleDetails}>
              <span>{vehicle.brand}</span>
              <span>{vehicle.version}</span>
            </div>
          </div>
        </div>
        <div className={styles.vehicleMeta}>
          <VehiclePlate plate={vehicle.plate} />
          <span className={styles.metaItem}>
            <Gauge aria-hidden size={18} weight="regular" />
            {formatMileage(vehicle.mileage)} km
          </span>
          <Link
            className={styles.manageButton}
            href={`/garagem/${vehicle.id}/gerenciar`}
          >
            <GearSix aria-hidden size={18} weight="bold" />
            Gerenciar
          </Link>
        </div>
      </section>

      <section className={styles.maintenanceSection}>
        <div className={styles.viewControl}>
          <SegmentedControl
            ariaLabel="Visualização das manutenções"
            onChange={changeView}
            options={viewOptions}
            value={selectedView}
          />
        </div>

        <div aria-live="polite">
          {selectedView === "history" ? (
            <>
              <header className={styles.sectionHeading}>
                <div>
                  <span>Serviços concluídos</span>
                  <h2>Histórico de manutenção</h2>
                </div>
                <ClockCounterClockwiseIcon aria-hidden size={27} weight="duotone" />
              </header>

              {maintenanceItems.length > 0 ? (
                <div className={styles.timeline}>
                  {maintenanceItems.map((item) => {
                    const toneClass = item.readonly ? styles.readonly : styles.done;

                    return (
                      <article
                        className={styles.historyItem + (item.readonly ? ` ${styles.historyItemReadonly}` : "")}
                        key={item.id}
                      >
                        <span className={`${styles.timelineMarker} ${toneClass}`}>
                          {item.readonly
                            ? <LockKey aria-hidden size={16} weight="bold" />
                            : <CheckCircle aria-hidden size={16} weight="fill" />}
                        </span>

                        <div className={`app-card ${styles.historyCard}`}>
                          <div className={styles.cardHeader}>
                            <h3>{item.title}</h3>
                            <div className={styles.badges}>
                              <span className={`${styles.statusBadge} ${toneClass}`}>
                                <CheckCircle aria-hidden size={14} weight="fill" />
                                Realizada
                              </span>
                              {item.readonly && (
                                <span className={styles.readonlyBadge}>
                                  <LockKey aria-hidden size={13} weight="fill" />
                                  Apenas leitura
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={styles.itemMeta}>
                            <span>
                              <CalendarBlank aria-hidden size={18} weight="bold" />
                              {item.date}
                            </span>
                            <span>
                              <Gauge aria-hidden size={18} weight="regular" />
                              {formatMileage(item.mileage)} km
                            </span>
                            <Link
                              className={styles.editLink}
                              href={`/garagem/${vehicle.id}/manutencao/${item.id}`}
                            >
                              {item.readonly
                                ? <Eye aria-hidden size={14} weight="bold" />
                                : <PencilSimple aria-hidden size={14} weight="bold" />}
                              {item.readonly ? "Detalhes" : "Comprovantes"}
                            </Link>
                          </div>

                          {item.attachment && (
                            <span className={styles.attachmentLink}>
                              <FilePdf aria-hidden size={18} weight="bold" />
                              {item.attachment}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.inlineEmptyState}>
                  <CardsIcon  aria-hidden size={30} weight="duotone" />
                  <h3>Nenhuma manutenção concluída</h3>
                  <p>Os serviços aparecerão aqui depois que forem marcados como realizados.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <header className={styles.sectionHeading}>
                <div>
                  <span>Prazos e lembretes</span>
                  <h2>Alertas de manutenção</h2>
                </div>
                <BellRinging aria-hidden size={27} weight="duotone" />
              </header>

              {alertItems.length > 0 ? (
                <div className={styles.alertList}>
                  {alertItems.map((item) => {
                    const toneClass = getAlertTone(item);

                    return (
                      <article className={`app-card ${styles.alertCard}`} key={item.id}>
                        <div className={styles.cardHeader}>
                          <div>
                            <span className={styles.alertEyebrow}>Prazo: {item.date}</span>
                            <h3>{item.title}</h3>
                          </div>
                          <span className={`${styles.statusBadge} ${toneClass}`}>
                            <WarningCircle aria-hidden size={14} weight="fill" />
                            {item.status}
                          </span>
                        </div>

                        <p className={styles.alertDescription}>{item.description}</p>

                        <div className={styles.alertFooter}>
                          <span>
                            <Wrench aria-hidden size={18} weight="bold" />
                            {item.category}
                          </span>
                          <Link
                            className={styles.editLink}
                            href={`/garagem/${vehicle.id}/alerta/${item.id}`}
                          >
                            <PencilSimple aria-hidden size={14} weight="bold" />
                            Abrir alerta
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.inlineEmptyState}>
                  <BellRinging aria-hidden size={30} weight="duotone" />
                  <h3>Nenhuma manutenção pendente</h3>
                  <p>Novos lembretes de manutenção aparecerão nesta visualização.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Link
        aria-label="Adicionar manutenção"
        className={`app-floating-action ${styles.addMaintenanceButton}`}
        href={`/garagem/${vehicle.id}/manutencao`}
      >
        <Plus aria-hidden size={28} weight="regular" />
      </Link>
    </AppShell>
  );
}
