"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import AppShell from "../../../../components/app-shell";
import { getAuthSession } from "../../../../auth-session";
import { getAuthErrorMessage } from "../../../../auth-api";
import MaintenanceForm from "../../../_components/maintenance-form";
import PageTopBar from "../../../_components/page-top-bar";
import {
  buildMaintenanceAlertPayload,
  getMaintenanceAlert,
  listServiceTypes,
  resolveServiceTypeIds,
  updateMaintenanceAlert,
} from "../../../_lib/garage-api";

export default function MaintenanceAlertPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const alertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const [retryRevision, setRetryRevision] = useState(0);
  const [requestState, setRequestState] = useState({
    alert: null,
    category: "",
    error: "",
    loading: true,
    notFound: false,
    readOnly: false,
    serviceTypes: [],
  });

  useEffect(() => {
    let active = true;

    async function loadAlert() {
      setRequestState((current) => ({ ...current, error: "", loading: true, notFound: false }));
      try {
        const [alert, loadedServiceTypes] = await Promise.all([
          getMaintenanceAlert(vehicleId, alertId),
          listServiceTypes(),
        ]);
        const serviceTypes = await resolveServiceTypeIds(loadedServiceTypes);
        const currentServiceType = serviceTypes.find((item) => item.id === alert.serviceTypeId);

        if (!currentServiceType) {
          throw new Error("O tipo de serviço deste alerta não está disponível.");
        }

        const normalizedServiceTypes = serviceTypes.map((item) => (
          item.id === alert.serviceTypeId
            ? { ...item, name: alert.serviceType.name }
            : item
        ));
        const currentUserId = Number(getAuthSession()?.user?.id);

        if (active) {
          setRequestState({
            alert,
            category: currentServiceType.identifier,
            error: "",
            loading: false,
            notFound: false,
            readOnly: alert.status !== "pending" || currentUserId !== alert.userId,
            serviceTypes: normalizedServiceTypes,
          });
        }
      } catch (error) {
        if (active) {
          setRequestState({
            alert: null,
            category: "",
            error: getAuthErrorMessage(
              error,
              "Não foi possível carregar o alerta. Tente novamente.",
            ),
            loading: false,
            notFound: error?.status === 404,
            readOnly: false,
            serviceTypes: [],
          });
        }
      }
    }

    void loadAlert();
    return () => { active = false; };
  }, [alertId, retryRevision, vehicleId]);

  const submitAlert = async ({ form }) => {
    const serviceType = requestState.serviceTypes.find((item) => (
      item.identifier === form.category
    ));
    const payload = buildMaintenanceAlertPayload({
      fields: [],
      form,
      serviceType,
    });
    await updateMaintenanceAlert(vehicleId, alertId, payload);
    router.push(`/garagem/${vehicleId}`);
  };

  return (
    <AppShell>
      <PageTopBar title="Alerta de manutenção" />

      {requestState.loading ? (
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden size={25} weight="bold" />
          <p>Carregando alerta...</p>
        </section>
      ) : !requestState.alert ? (
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>{requestState.notFound ? "Alerta não encontrado" : "Não foi possível carregar o alerta"}</h2>
          <p>
            {requestState.notFound
              ? "Volte ao veículo e selecione um alerta existente."
              : requestState.error}
          </p>
          {requestState.notFound ? (
            <Link className="app-empty-link" href={`/garagem/${vehicleId}`}>Voltar ao veículo</Link>
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
        <MaintenanceForm
          alertOnly
          alertSubmitLabel="Salvar alterações"
          initialValues={{
            category: requestState.category,
            date: requestState.alert.dateDue,
            description: requestState.alert.description,
            mileageDue: requestState.alert.mileageDue ?? "",
          }}
          intro={requestState.readOnly
            ? "Este alerta está disponível somente para consulta."
            : "Atualize a categoria, os prazos previstos ou a descrição do alerta."}
          key={requestState.alert.id}
          onSubmit={submitAlert}
          readOnly={requestState.readOnly}
          serviceTypes={requestState.serviceTypes}
          submitLabel="Salvar alterações"
          title={requestState.readOnly ? "Detalhes do alerta" : "Editar alerta"}
        />
      )}
    </AppShell>
  );
}
