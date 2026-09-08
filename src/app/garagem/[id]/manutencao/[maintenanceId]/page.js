"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "../../../../components/app-shell";
import MaintenanceForm from "../../../_components/maintenance-form";
import PageTopBar from "../../../_components/page-top-bar";
import { getMaintenanceById, getVehicleById } from "../../../../mock-data";
import styles from "./page.module.css";

function getInitialValues(maintenance) {
  return {
    status: maintenance.status === "Realizada" ? "Realizada" : "A realizar",
    category: maintenance.category ?? "Mecânica",
    mileage: String(maintenance.mileage ?? ""),
    date: maintenance.date ?? "",
    description: maintenance.description ?? maintenance.title ?? "",
    value: maintenance.value ?? "",
    receiptName: maintenance.attachment ?? "",
  };
}

export default function EditMaintenancePage() {
  const params = useParams();
  const vehicle = getVehicleById(params.id);
  const maintenance = getMaintenanceById(params.id, params.maintenanceId);

  if (!vehicle || !maintenance) {
    return (
      <AppShell>
        <PageTopBar title="Editar manutenção" />
        <section className={styles.emptyState}>
          <h2>Manutenção não encontrada</h2>
          <p>Volte ao histórico do veículo e selecione um registro existente.</p>
          <Link className={styles.emptyLink} href={"/garagem/" + params.id}>Ir para histórico</Link>
        </section>
      </AppShell>
    );
  }

  if (maintenance.readonly) {
    return (
      <AppShell>
        <PageTopBar title="Editar manutenção" />
        <section className={styles.emptyState}>
          <h2>Registro somente leitura</h2>
          <p>Esta manutenção pertence ao histórico antigo do veículo e não pode ser editada.</p>
          <Link className={styles.emptyLink} href={"/garagem/" + params.id}>Voltar ao histórico</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTopBar title="Editar manutenção" />
      <MaintenanceForm
        initialValues={getInitialValues(maintenance)}
        intro="Atualize os dados do serviço selecionado."
        submitLabel="Salvar Alterações"
        title="Editar Manutenção"
      />
    </AppShell>
  );
}
