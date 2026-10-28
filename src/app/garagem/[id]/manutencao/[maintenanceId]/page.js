"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import AppShell from "../../../../components/app-shell";
import MaintenanceReceiptForm from "../../../_components/maintenance-receipt-form";
import PageTopBar from "../../../_components/page-top-bar";
import { getMaintenance, getServiceTypeFields } from "../../../_lib/garage-api";
import { getAuthErrorMessage } from "../../../../auth-api";

async function fetchMaintenanceDetails(maintenanceId, vehicleId) {
  const maintenance = await getMaintenance(maintenanceId);
  if (maintenance.vehicleId !== Number(vehicleId)) {
    const error = new Error("Manutenção não encontrada para este veículo.");
    error.status = 404;
    throw error;
  }

  let fields = [];
  try {
    fields = await getServiceTypeFields(maintenance.serviceType.identifier);
  } catch {
    // Os nomes técnicos do payload continuam disponíveis quando os metadados falham.
  }

  return { fields, maintenance };
}

export default function MaintenanceDetailsPage() {
  const params = useParams();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const maintenanceId = Array.isArray(params.maintenanceId)
    ? params.maintenanceId[0]
    : params.maintenanceId;
  const [retryRevision, setRetryRevision] = useState(0);
  const [requestState, setRequestState] = useState({
    error: "",
    fields: [],
    loading: true,
    maintenance: null,
    notFound: false,
  });

  useEffect(() => {
    let active = true;

    async function loadMaintenance() {
      setRequestState((current) => ({ ...current, error: "", loading: true, notFound: false }));
      try {
        const { fields, maintenance } = await fetchMaintenanceDetails(maintenanceId, vehicleId);
        if (active) {
          setRequestState({
            error: "",
            fields,
            loading: false,
            maintenance,
            notFound: false,
          });
        }
      } catch (error) {
        if (active) {
          setRequestState({
            error: getAuthErrorMessage(
              error,
              "Não foi possível carregar a manutenção. Tente novamente.",
            ),
            fields: [],
            loading: false,
            maintenance: null,
            notFound: error?.status === 404,
          });
        }
      }
    }

    void loadMaintenance();
    return () => { active = false; };
  }, [maintenanceId, retryRevision, vehicleId]);

  const refreshMaintenance = async () => {
    const { fields, maintenance } = await fetchMaintenanceDetails(maintenanceId, vehicleId);
    setRequestState({
      error: "",
      fields,
      loading: false,
      maintenance,
      notFound: false,
    });
  };

  return (
    <AppShell>
      <PageTopBar title="Manutenção" />

      {requestState.loading ? (
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden size={25} weight="bold" />
          <p>Carregando manutenção...</p>
        </section>
      ) : !requestState.maintenance ? (
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>{requestState.notFound ? "Manutenção não encontrada" : "Não foi possível carregar a manutenção"}</h2>
          <p>
            {requestState.notFound
              ? "Volte ao histórico do veículo e selecione um registro existente."
              : requestState.error}
          </p>
          {requestState.notFound ? (
            <Link className="app-empty-link" href={`/garagem/${vehicleId}`}>Ir para histórico</Link>
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
      ) : (
        <MaintenanceReceiptForm
          maintenance={requestState.maintenance}
          onRefresh={refreshMaintenance}
          serviceFields={requestState.fields}
        />
      )}
    </AppShell>
  );
}
