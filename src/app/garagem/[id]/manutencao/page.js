"use client";

import AppShell from "../../../components/app-shell";
import MaintenanceForm from "../../_components/maintenance-form";
import PageTopBar from "../../_components/page-top-bar";

export default function NewMaintenancePage() {
  return (
    <AppShell>
      <PageTopBar title="Registrar manutenção" />
      <MaintenanceForm
        intro="Insira os dados do serviço realizado ou planejado."
        submitLabel="Salvar Manutenção"
        title="Registro de Manutenção"
      />
    </AppShell>
  );
}
