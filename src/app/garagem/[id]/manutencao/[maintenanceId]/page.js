"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "../../../../components/app-shell";
import MaintenanceForm from "../../../_components/maintenance-form";
import MaintenanceReceiptForm from "../../../_components/maintenance-receipt-form";
import PageTopBar from "../../../_components/page-top-bar";
import { getMaintenanceById, getVehicleById } from "../../../../mock-data";

function getInitialValues(maintenance) {
  return {
    status: "A realizar",
    category: maintenance.category ?? "Mecânica",
    mileage: "",
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
        <section className="app-empty-state app-empty-state--narrow">
          <h2>Manutenção não encontrada</h2>
          <p>Volte ao histórico do veículo e selecione um registro existente.</p>
          <Link className="app-empty-link" href={"/garagem/" + params.id}>Ir para histórico</Link>
        </section>
      </AppShell>
    );
  }

  if (maintenance.readonly) {
    return (
      <AppShell>
        <PageTopBar title="Editar manutenção" />
        <section className="app-empty-state app-empty-state--narrow">
          <h2>Registro somente leitura</h2>
          <p>Esta manutenção pertence ao histórico antigo do veículo e não pode ser editada.</p>
          <Link className="app-empty-link" href={"/garagem/" + params.id}>Voltar ao histórico</Link>
        </section>
      </AppShell>
    );
  }

  if (maintenance.status === "Realizada") {
    return (
      <AppShell>
        <PageTopBar title="Comprovante" />
        <MaintenanceReceiptForm maintenance={maintenance} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTopBar title="Editar alerta" />
      <MaintenanceForm
        completionSubmitLabel="Concluir manutenção"
        initialValues={getInitialValues(maintenance)}
        intro="Atualize o prazo ou marque o serviço como realizado."
        submitLabel="Salvar alerta"
        title="Editar alerta de manutenção"
      />
    </AppShell>
  );
}
