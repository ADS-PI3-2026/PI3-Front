"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarBlank,
  CheckCircle,
  FilePdf,
  Gauge,
  LockKey,
  PencilSimple,
  Plus,
  Repeat,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import AppShell from "../../components/app-shell";
import VehiclePlate from "../../components/vehicle-plate";
import PageTopBar from "../_components/page-top-bar";
import { formatMileage, getVehicleById, getVehicleMaintenance } from "../../mock-data";
import styles from "./page.module.css";

function getStatusClass(item) {
  if (item.readonly) return styles.readonly;
  if (item.status === "Realizada") return styles.done;
  if (item.status === "Atrasada") return styles.overdue;
  return styles.pending;
}

function getTimelineIcon(item) {
  if (item.readonly) return <LockKey aria-hidden size={16} weight="bold" />;
  if (item.status === "Realizada") return <CheckCircle aria-hidden size={16} weight="fill" />;
  if (item.status === "Atrasada") return <WarningCircle aria-hidden size={16} weight="fill" />;
  return <Wrench aria-hidden size={17} weight="fill" />;
}

export default function VehicleHistoryPage() {
  const params = useParams();
  const vehicle = getVehicleById(params.id);
  const maintenanceItems = getVehicleMaintenance(params.id);

  if (!vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Histórico" />
        <section className={styles.emptyState}>
          <h2>Veículo não encontrado</h2>
          <p>Volte para a garagem e selecione um automóvel cadastrado.</p>
          <Link className={styles.emptyLink} href="/garagem">Ir para garagem</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTopBar title="Histórico" />

      <section className={styles.vehicleHero}>
        <h2>{vehicle.name}</h2>
        <div className={styles.vehicleMeta}>
          <VehiclePlate className={styles.heroPlate} plate={vehicle.plate} />
          <span className={styles.metaItem}>
            <Gauge aria-hidden size={18} weight="regular" />
            {formatMileage(vehicle.mileage)} km
          </span>
          <button className={styles.transferButton} type="button" onClick={(event) => alert("Transferir veículo para outro proprietário")}>
            <Repeat aria-hidden size={18} weight="bold" />
            Transferir
          </button>
        </div>
      </section>

      <section aria-labelledby="maintenance-history-title" className={styles.historySection}>
        <h2 id="maintenance-history-title">Histórico de Manutenção</h2>
        <div className={styles.timeline}>
          {maintenanceItems.map((item) => {
            const toneClass = getStatusClass(item);
            return (
              <article className={styles.historyItem + (item.readonly ? " " + styles.historyItemReadonly : "")} key={item.id}>
                <span className={styles.timelineMarker + " " + toneClass}>
                  {getTimelineIcon(item)}
                </span>
                <div className={styles.historyCard}>
                  <div className={styles.cardHeader}>
                    <h3>{item.title}</h3>
                    <div className={styles.badges}>
                      <span className={styles.statusBadge + " " + toneClass}>
                        {item.status === "Realizada" ? <CheckCircle aria-hidden size={14} weight="fill" /> : <WarningCircle aria-hidden size={14} weight="fill" />}
                        {item.status}
                      </span>
                      {item.readonly && (
                        <span className={styles.readonlyBadge}>
                          <LockKey aria-hidden size={13} weight="fill" />
                          Apenas Leitura
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
                      <Link className={styles.editLink} href={"/garagem/" + vehicle.id + "/manutencao/" + item.id}>
                        <PencilSimple aria-hidden size={14} weight="bold" />
                        Editar
                      </Link>
                    )}
                  </div>
                  {item.attachment && (
                    <a className={styles.attachmentLink} href="#" onClick={(event) => event.preventDefault()}>
                      <FilePdf aria-hidden size={18} weight="bold" />
                      {item.attachment}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Link
        aria-label="Adicionar manutenção"
        className={styles.addMaintenanceButton}
        href={"/garagem/" + vehicle.id + "/manutencao"}
      >
        <Plus aria-hidden size={28} weight="regular" />
      </Link>
    </AppShell>
  );
}
