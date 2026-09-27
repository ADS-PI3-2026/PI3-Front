"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BellRinging,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  FilePdf,
  Gauge,
  LockKey,
  PencilSimple,
  Plus,
  GearSix,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import AppShell from "../../components/app-shell";
import SegmentedControl from "../../components/segmented-control";
import VehicleBrandLogo from "../../components/vehicle-brand-logo";
import VehiclePlate from "../../components/vehicle-plate";
import PageTopBar from "../_components/page-top-bar";
import {
  formatMileage,
  getVehicleAlerts,
  getVehicleById,
  getVehicleMaintenance,
} from "../../mock-data";
import styles from "./page.module.css";

const VIEW_LOAD_DELAY = 450;

function getAlertTone(item) {
  return item.status === "Atrasada" ? styles.overdue : styles.pending;
}

export default function VehicleHistoryPage() {
  const params = useParams();
  const vehicle = getVehicleById(params.id);
  const maintenanceItems = getVehicleMaintenance(params.id);
  const alertItems = getVehicleAlerts(params.id);
  const loadTimerRef = useRef(null);
  const [selectedView, setSelectedView] = useState("history");
  const [contentView, setContentView] = useState("history");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(loadTimerRef.current);
  }, []);

  const changeView = (nextView) => {
    if (nextView === selectedView || isLoading) {
      return;
    }

    setSelectedView(nextView);
    setIsLoading(true);
    loadTimerRef.current = window.setTimeout(() => {
      setContentView(nextView);
      setIsLoading(false);
    }, VIEW_LOAD_DELAY);
  };

  if (!vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Manutenções" />
        <section className="app-empty-state">
          <h2>Veículo não encontrado</h2>
          <p>Volte para a garagem e selecione um automóvel cadastrado.</p>
          <Link className="app-empty-link" href="/garagem">Ir para garagem</Link>
        </section>
      </AppShell>
    );
  }

  const viewOptions = [
    {
      label: `Histórico (${maintenanceItems.length})`,
      value: "history",
    },
    {
      label: `Alertas (${alertItems.length})`,
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
          <h2>{vehicle.name}</h2>
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
            Gerenciar veículo
          </Link>
        </div>
      </section>

      <section className={styles.maintenanceSection}>
        <div className={styles.viewControl}>
          <SegmentedControl
            ariaLabel="Visualização das manutenções"
            disabled={isLoading}
            onChange={changeView}
            options={viewOptions}
            value={selectedView}
          />
        </div>

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
              <span>
                {selectedView === "history"
                  ? "Carregando histórico..."
                  : "Carregando alertas..."}
              </span>
            </div>
          ) : contentView === "history" ? (
            <>
              <header className={styles.sectionHeading}>
                <div>
                  <span>Serviços concluídos</span>
                  <h2>Histórico de manutenção</h2>
                </div>
                <CheckCircle aria-hidden size={27} weight="duotone" />
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
                            {!item.readonly && (
                              <Link
                                className={styles.editLink}
                                href={`/garagem/${vehicle.id}/manutencao/${item.id}`}
                              >
                                <PencilSimple aria-hidden size={14} weight="bold" />
                                Comprovante
                              </Link>
                            )}
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
                  <CheckCircle aria-hidden size={30} weight="duotone" />
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
                            href={`/garagem/${vehicle.id}/manutencao/${item.id}`}
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
                  <h3>Nenhum alerta pendente</h3>
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
