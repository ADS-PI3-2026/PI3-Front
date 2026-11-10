"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellRingingIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  FilePdfIcon,
  GaugeIcon,
  LockKeyIcon,
  EyeIcon,
  PencilSimpleIcon,
  PlusIcon,
  GearSixIcon,
  WarningCircleIcon,
  WrenchIcon,
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
  listVehicleMaintenanceDetails,
  listVehicleAlertsPage,
  listVehicleMaintenancesPage,
} from "../_lib/garage-api";
import { getAuthErrorMessage } from "../../auth-api";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatMileage(value) {
  return mileageFormatter.format(value);
}

function formatRegistrationDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Não informada";
  return `${match[3]}/${match[2]}/${match[1]}`;
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
  const [pagination, setPagination] = useState({
    alerts: { hasMore: false, page: 1, total: 0 },
    maintenances: { hasMore: false, page: 1, total: 0 },
  });
  const [loadMoreState, setLoadMoreState] = useState({ error: "", loading: "" });
  const [pdfState, setPdfState] = useState({ error: "", loading: false });

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
        const [maintenancePage, alertPage] = await Promise.all([
          listVehicleMaintenancesPage(vehicleId, 1),
          listVehicleAlertsPage(vehicleId, loadedVehicle.mileage, 1),
        ]);

        if (active) {
          setRequestState({
            alerts: alertPage.items,
            error: "",
            loading: false,
            maintenances: maintenancePage.items,
            notFound: false,
            vehicle: loadedVehicle,
          });
          setPagination({
            alerts: {
              hasMore: alertPage.hasMore,
              page: alertPage.page,
              total: alertPage.total,
            },
            maintenances: {
              hasMore: maintenancePage.hasMore,
              page: maintenancePage.page,
              total: maintenancePage.total,
            },
          });
          setLoadMoreState({ error: "", loading: "" });
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
        setPagination({
          alerts: { hasMore: false, page: 1, total: 0 },
          maintenances: { hasMore: false, page: 1, total: 0 },
        });
        setLoadMoreState({ error: "", loading: "" });
      }
    }

    void loadVehicleHistory();
    return () => { active = false; };
  }, [retryRevision, vehicleId]);

  const changeView = (nextView) => {
    setSelectedView(nextView);
    setLoadMoreState({ error: "", loading: "" });
  };

  const loadMore = async (resource) => {
    if (loadMoreState.loading || !pagination[resource].hasMore || !requestState.vehicle) return;
    setLoadMoreState({ error: "", loading: resource });

    try {
      const nextPage = resource === "maintenances"
        ? await listVehicleMaintenancesPage(vehicleId, pagination.maintenances.page + 1)
        : await listVehicleAlertsPage(
          vehicleId,
          requestState.vehicle.mileage,
          pagination.alerts.page + 1,
        );

      setRequestState((current) => {
        const knownIds = new Set(current[resource].map((item) => item.id));
        const newItems = nextPage.items.filter((item) => !knownIds.has(item.id));
        return { ...current, [resource]: [...current[resource], ...newItems] };
      });
      setPagination((current) => ({
        ...current,
        [resource]: {
          hasMore: nextPage.hasMore,
          page: nextPage.page,
          total: nextPage.total,
        },
      }));
      setLoadMoreState({ error: "", loading: "" });
    } catch (error) {
      setLoadMoreState({
        error: getAuthErrorMessage(error, "Não foi possível carregar mais registros. Tente novamente."),
        loading: "",
      });
    }
  };

  const downloadHistory = async () => {
    if (pdfState.loading || !requestState.vehicle) return;
    setPdfState({ error: "", loading: true });

    try {
      const maintenances = await listVehicleMaintenanceDetails(vehicleId);
      if (maintenances.length === 0) {
        setPdfState({ error: "Ainda não há manutenções para incluir no PDF.", loading: false });
        return;
      }
      const { downloadVehicleHistoryPdf } = await import("../_lib/vehicle-history-pdf");
      downloadVehicleHistoryPdf({ maintenances, vehicle: requestState.vehicle });
      setPdfState({ error: "", loading: false });
    } catch {
      setPdfState({
        error: "Não foi possível gerar o PDF completo. Confira sua conexão e tente novamente.",
        loading: false,
      });
    }
  };

  if (requestState.loading) {
    return (
      <AppShell>
        <PageTopBar backHref="/garagem" title="Manutenções" />
        <section className={styles.loadingState} role="status">
          <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
          <span>Carregando dados do veículo...</span>
        </section>
      </AppShell>
    );
  }

  if (!requestState.vehicle) {
    return (
      <AppShell>
        <PageTopBar backHref="/garagem" title="Manutenções" />
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
      label: `Histórico (${pagination.maintenances.total})`,
      value: "history",
    },
    {
      label: `Manutenções (${pagination.alerts.total})`,
      value: "alerts",
    },
  ];

  return (
    <AppShell>
      <PageTopBar backHref="/garagem" title="Detalhes do veículo" />

      <section className={styles.vehicleHero}>
        <div className={styles.vehicleIdentity}>
          <VehicleBrandLogo
            brandId={vehicle.brandId}
            className={styles.brandLogo}
            imageSize={160}
            type={vehicle.type}
          />
          <span className={styles.vehicleBrand}>{vehicle.brand}</span>
          <h2>{vehicle.model}</h2>
        </div>

        <div className={styles.vehicleTopDetails}>
          <dl className={`${styles.vehicleFacts} ${styles.vehicleFactsTop}`}>
            <div>
              <dt>Ano</dt>
              <dd>{vehicle.year || "Não informado"}</dd>
            </div>
            <div>
              <dt>Cor</dt>
              <dd>{vehicle.color || "Não informada"}</dd>
            </div>
          </dl>
          <VehiclePlate plate={vehicle.plate} type={vehicle.type} />
        </div>

        <dl className={`${styles.vehicleFacts} ${styles.vehicleFactsBottom}`}>
          <div>
            <dt>Quilometragem</dt>
            <dd>{formatMileage(vehicle.mileage)} km</dd>
          </div>
          <div>
            <dt>Cadastro</dt>
            <dd>{formatRegistrationDate(vehicle.createdAt)}</dd>
          </div>
        </dl>

        <Link
          className={styles.manageButton}
          href={`/garagem/${vehicle.id}/gerenciar`}
        >
          <GearSixIcon aria-hidden className={styles.manageIcon} size={19} weight="bold" />
          <span>Gerenciar veículo</span>
          <CaretRightIcon aria-hidden className={styles.manageArrow} size={18} weight="bold" />
        </Link>
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

        <div aria-busy={Boolean(loadMoreState.loading)} aria-live="polite">
          {selectedView === "history" ? (
            <>
              <header className={styles.sectionHeading}>
                <div>
                  <span>Serviços concluídos</span>
                  <h2>Histórico de manutenção</h2>
                </div>
                <div className={styles.sectionHeadingActions}>
                  <ClockCounterClockwiseIcon aria-hidden size={27} weight="duotone" />
                </div>
              </header>

              {pagination.maintenances.total > 0 && (
                <div className={styles.pdfActionRow}>
                  <button
                    className={styles.pdfButton}
                    disabled={pdfState.loading}
                    onClick={() => void downloadHistory()}
                    type="button"
                  >
                    {pdfState.loading
                      ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />
                      : <FilePdfIcon aria-hidden size={18} weight="bold" />}
                    {pdfState.loading ? "Preparando seu histórico..." : "Baixar histórico em PDF"}
                  </button>
                </div>
              )}

              {pdfState.error && (
                <p className={styles.pdfError} role="alert">{pdfState.error}</p>
              )}

              {maintenanceItems.length > 0 ? (
                <>
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
                            ? <LockKeyIcon aria-hidden size={16} weight="bold" />
                            : <CheckCircleIcon aria-hidden size={16} weight="fill" />}
                        </span>

                        <div className={`app-card ${styles.historyCard}`}>
                          <div className={styles.cardHeader}>
                            <h3>{item.title}</h3>
                            <div className={styles.badges}>
                              <span className={`${styles.statusBadge} ${toneClass}`}>
                                <CheckCircleIcon aria-hidden size={14} weight="fill" />
                                Realizada
                              </span>
                              {item.readonly && (
                                <span className={styles.readonlyBadge}>
                                  <LockKeyIcon aria-hidden size={13} weight="fill" />
                                  Apenas leitura
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={styles.itemMeta}>
                            <span>
                              <CalendarBlankIcon aria-hidden size={18} weight="bold" />
                              {item.date}
                            </span>
                            <span>
                              <GaugeIcon aria-hidden size={18} weight="regular" />
                              {formatMileage(item.mileage)} km
                            </span>
                            <Link
                              className={styles.editLink}
                              href={`/garagem/${vehicle.id}/manutencao/${item.id}`}
                            >
                              {item.readonly
                                ? <EyeIcon aria-hidden size={14} weight="bold" />
                                : <PencilSimpleIcon aria-hidden size={14} weight="bold" />}
                              Ver detalhes
                            </Link>
                          </div>

                          {item.attachment && (
                            <span className={styles.attachmentLink}>
                              <FilePdfIcon aria-hidden size={18} weight="bold" />
                              {item.attachment}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                    })}
                  </div>
                  {(pagination.maintenances.hasMore || loadMoreState.error) && (
                    <div className={styles.paginationFooter}>
                      {loadMoreState.error && selectedView === "history" && (
                        <p role="alert">{loadMoreState.error}</p>
                      )}
                      {pagination.maintenances.hasMore && (
                        <button
                          disabled={loadMoreState.loading === "maintenances"}
                          onClick={() => void loadMore("maintenances")}
                          type="button"
                        >
                          {loadMoreState.loading === "maintenances" && (
                            <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />
                          )}
                          {loadMoreState.loading === "maintenances"
                            ? "Carregando..."
                            : "Carregar mais manutenções"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.inlineEmptyState}>
                  <CardsIcon  aria-hidden size={30} weight="duotone" />
                  <h3>Nenhuma manutenção concluída</h3>
                  <p>Os serviços aparecerão aqui depois que forem marcados como realizados</p>
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
                <BellRingingIcon aria-hidden size={27} weight="duotone" />
              </header>

              {alertItems.length > 0 ? (
                <>
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
                            <WarningCircleIcon aria-hidden size={14} weight="fill" />
                            {item.status}
                          </span>
                        </div>

                        <p className={styles.alertDescription}>{item.description}</p>

                        <div className={styles.alertFooter}>
                          <span>
                            <WrenchIcon aria-hidden size={18} weight="bold" />
                            {item.category}
                          </span>
                          <Link
                            className={styles.editLink}
                            href={`/garagem/${vehicle.id}/alerta/${item.id}`}
                          >
                            <PencilSimpleIcon aria-hidden size={14} weight="bold" />
                            Abrir alerta
                          </Link>
                        </div>
                      </article>
                    );
                    })}
                  </div>
                  {(pagination.alerts.hasMore || loadMoreState.error) && (
                    <div className={styles.paginationFooter}>
                      {loadMoreState.error && selectedView === "alerts" && (
                        <p role="alert">{loadMoreState.error}</p>
                      )}
                      {pagination.alerts.hasMore && (
                        <button
                          disabled={loadMoreState.loading === "alerts"}
                          onClick={() => void loadMore("alerts")}
                          type="button"
                        >
                          {loadMoreState.loading === "alerts" && (
                            <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />
                          )}
                          {loadMoreState.loading === "alerts"
                            ? "Carregando..."
                            : "Carregar mais alertas"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.inlineEmptyState}>
                  <BellRingingIcon aria-hidden size={30} weight="duotone" />
                  <h3>Nenhuma manutenção pendente</h3>
                  <p>Novos lembretes de manutenção aparecerão nesta visualização</p>
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
        <PlusIcon aria-hidden size={28} weight="regular" />
      </Link>
    </AppShell>
  );
}
