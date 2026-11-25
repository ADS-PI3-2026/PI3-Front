"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
  CardsIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import AppShell from "../../components/app-shell";
import { useSession } from "../../components/session-provider";
import { useToast } from "../../components/toast-provider";
import SegmentedControl from "../../components/segmented-control";
import VehicleBrandLogo from "../../components/vehicle-brand-logo";
import VehiclePlate from "../../components/vehicle-plate";
import PageTopBar from "../_components/page-top-bar";
import PageLoadingState from "../_components/page-loading-state";
import {
  getVehicle,
  getMaintenanceAlertErrorMessage,
  listVehicleMaintenanceDetails,
  listVehicleAlertsPage,
  listVehicleMaintenancesPage,
  updateMaintenanceAlert,
} from "../_lib/garage-api";
import { getAuthErrorMessage } from "../../auth-api";
import {
  createMaintenanceDraftKey,
  readMaintenanceDraft,
} from "../_lib/maintenance-draft";
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

function AlertCancellationDialog({ alert, busy, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={styles.cancelDialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
      ref={dialogRef}
    >
      <button
        aria-label="Fechar cancelamento"
        className={styles.cancelDialogClose}
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        <XIcon aria-hidden size={20} weight="bold" />
      </button>
      <span className={styles.cancelDialogIcon}>
        <XCircleIcon aria-hidden size={28} weight="duotone" />
      </span>
      <h2 id={titleId}>Cancelar alerta?</h2>
      <p className={styles.cancelDialogDescription} id={descriptionId}>
        O alerta “{alert.title}” será removido da lista de manutenções pendentes.
      </p>
      {error && (
        <p className="app-feedback app-feedback--error" role="alert">
          <WarningCircleIcon aria-hidden size={18} weight="fill" />
          {error}
        </p>
      )}
      <div className={styles.cancelDialogActions}>
        <ActionButton disabled={busy} onClick={onClose} type="button" variant="secondary">
          Manter alerta
        </ActionButton>
        <ActionButton disabled={busy} onClick={onConfirm} type="button" variant="danger">
          {busy ? "Cancelando..." : "Confirmar cancelamento"}
        </ActionButton>
      </div>
    </dialog>
  );
}

export default function VehicleHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const { showToast } = useToast();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const maintenanceDraftKey = createMaintenanceDraftKey(session?.user?.id, vehicleId);
  const [selectedView, setSelectedView] = useState(
    searchParams.get("aba") === "a-realizar" ? "alerts" : "history",
  );
  const [hasMaintenanceDraft, setHasMaintenanceDraft] = useState(false);
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
  const [pdfState, setPdfState] = useState({ loading: false });
  const [cancelDialog, setCancelDialog] = useState({ alert: null, error: "", pending: false });

  useEffect(() => {
    const refreshDraftState = () => {
      setHasMaintenanceDraft(Boolean(readMaintenanceDraft(maintenanceDraftKey)));
    };

    refreshDraftState();
    window.addEventListener("focus", refreshDraftState);
    window.addEventListener("storage", refreshDraftState);
    return () => {
      window.removeEventListener("focus", refreshDraftState);
      window.removeEventListener("storage", refreshDraftState);
    };
  }, [maintenanceDraftKey]);

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
    setPdfState({ loading: true });

    try {
      const maintenances = await listVehicleMaintenanceDetails(vehicleId);
      if (maintenances.length === 0) {
        setPdfState({ loading: false });
        showToast({ message: "Ainda não há manutenções para incluir no PDF.", tone: "info" });
        return;
      }
      const { downloadVehicleHistoryPdf } = await import("../_lib/vehicle-history-pdf");
      downloadVehicleHistoryPdf({ maintenances, vehicle: requestState.vehicle });
      setPdfState({ loading: false });
      showToast({ message: "Histórico em PDF gerado com sucesso.", tone: "success" });
    } catch {
      setPdfState({ loading: false });
      showToast({
        message: "Não foi possível gerar o PDF completo. Confira sua conexão e tente novamente.",
        tone: "error",
      });
    }
  };

  const openAlertCancellation = (alert) => {
    setCancelDialog({ alert, error: "", pending: false });
  };

  const closeAlertCancellation = () => {
    if (cancelDialog.pending) return;
    setCancelDialog({ alert: null, error: "", pending: false });
  };

  const confirmAlertCancellation = async () => {
    const alert = cancelDialog.alert;
    if (!alert || cancelDialog.pending) return;

    setCancelDialog((current) => ({ ...current, error: "", pending: true }));
    try {
      await updateMaintenanceAlert(vehicleId, alert.id, { status: "cancelled" });
      setRequestState((current) => ({
        ...current,
        alerts: current.alerts.filter((item) => item.id !== alert.id),
      }));
      setPagination((current) => ({
        ...current,
        alerts: {
          ...current.alerts,
          total: Math.max(0, current.alerts.total - 1),
        },
      }));
      setCancelDialog({ alert: null, error: "", pending: false });
      showToast({ message: "Alerta de manutenção cancelado com sucesso.", tone: "success" });
    } catch (error) {
      setCancelDialog((current) => ({
        ...current,
        error: getMaintenanceAlertErrorMessage(
          error,
          "Não foi possível cancelar o alerta. Tente novamente.",
        ),
        pending: false,
      }));
    }
  };

  if (requestState.loading) {
    return (
      <AppShell>
        <PageTopBar backHref="/garagem" title="Detalhes do veículo" />
        <PageLoadingState message="Carregando dados do veículo..." />
      </AppShell>
    );
  }

  if (!requestState.vehicle) {
    return (
      <AppShell>
        <PageTopBar backHref="/garagem" title="Detalhes do veículo" />
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
  const isMotorcycle = ["motorcycle", "motorcycles"].includes(vehicle.type);

  const viewOptions = [
    {
      label: `Realizadas (${pagination.maintenances.total})`,
      value: "history",
    },
    {
      label: `A realizar (${pagination.alerts.total})`,
      value: "alerts",
    },
  ];

  return (
    <AppShell>
      <PageTopBar backHref="/garagem" title="Detalhes do veículo" />

      <div className={styles.vehicleLayout}>
        <section className={`${styles.vehicleHero} ${isMotorcycle ? styles.motorcycleVehicle : ""}`}>
          <div className={styles.vehicleIdentity}>
            <VehicleBrandLogo
              brandId={vehicle.brandId}
              className={styles.brandLogo}
              imageSize={160}
              type={vehicle.type}
            />
            <div className={styles.vehicleIdentityCopy}>
              <span className={styles.vehicleBrand}>{vehicle.brand}</span>
              <h2>{vehicle.model}</h2>
            </div>
          </div>

          <VehiclePlate
            className={styles.vehiclePlate}
            plate={vehicle.plate}
            type={vehicle.type}
          />

          <div className={styles.vehicleDetails}>
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
          </div>

          <Link
            className={styles.manageButton}
            href={`/garagem/${vehicle.id}/gerenciar`}
          >
            <GearSixIcon aria-hidden size={20} weight="bold" />
            <span>Gerenciar veículo</span>
          </Link>

        </section>

        <section className={styles.maintenanceSection}>
          <header className={styles.maintenanceHeading}>
            <h2>Manutenções</h2>
            <p>Consulte os serviços realizados e acompanhe os próximos cuidados do veículo</p>
          </header>

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
                    <h2>Realizadas</h2>
                  </div>
                  <div className={styles.sectionHeadingActions}>
                    {pagination.maintenances.total > 0 && (
                      <button
                        className={styles.pdfButton}
                        disabled={pdfState.loading}
                        onClick={() => void downloadHistory()}
                        type="button"
                      >
                        {pdfState.loading
                          ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />
                          : <FilePdfIcon aria-hidden size={18} weight="bold" />}
                        {pdfState.loading ? "Preparando..." : "Baixar PDF"}
                      </button>
                    )}
                  </div>
                </header>

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
                    <h2>A realizar</h2>
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

                          <div className={styles.alertQuickActions}>
                            <button
                              className={styles.cancelAlertButton}
                              onClick={() => openAlertCancellation(item)}
                              type="button"
                            >
                              <XCircleIcon aria-hidden size={17} weight="bold" />
                              Cancelar alerta
                            </button>
                            <Link
                              className={styles.completeAlertButton}
                              href={`/garagem/${vehicle.id}/alerta/${item.id}?acao=concluir`}
                            >
                              <CheckCircleIcon aria-hidden size={17} weight="bold" />
                              Concluir alerta
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

      </div>
      <Link
        aria-label={`${selectedView === "history"
          ? "Registrar manutenção realizada"
          : "Programar manutenção a realizar"}${hasMaintenanceDraft ? ". Há um rascunho salvo" : ""}`}
        className={`app-floating-action ${styles.addMaintenanceButton}`}
        href={`/garagem/${vehicle.id}/manutencao?tipo=${selectedView === "history" ? "realizada" : "alerta"}`}
        title={hasMaintenanceDraft ? "Continuar rascunho de manutenção" : undefined}
      >
        <PlusIcon aria-hidden size={28} weight="regular" />
        {hasMaintenanceDraft && (
          <span aria-hidden className={styles.draftBadge}>
            <PencilSimpleIcon size={12} weight="bold" />
          </span>
        )}
      </Link>
      {cancelDialog.alert && (
        <AlertCancellationDialog
          alert={cancelDialog.alert}
          busy={cancelDialog.pending}
          error={cancelDialog.error}
          onClose={closeAlertCancellation}
          onConfirm={() => void confirmAlertCancellation()}
        />
      )}
    </AppShell>
  );
}
