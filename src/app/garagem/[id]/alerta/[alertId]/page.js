"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleNotch, WarningCircle, XCircle } from "@phosphor-icons/react";
import ActionButton from "../../../../components/action-button";
import AppShell from "../../../../components/app-shell";
import { getAuthSession } from "../../../../auth-session";
import { getAuthErrorMessage } from "../../../../auth-api";
import MaintenanceForm from "../../../_components/maintenance-form";
import PageTopBar from "../../../_components/page-top-bar";
import {
  buildMaintenanceAlertPayload,
  getMaintenanceAlert,
  getMaintenanceAlertErrorMessage,
  getVehicle,
  listServiceTypes,
  resolveServiceTypeIds,
  updateMaintenanceAlert,
} from "../../../_lib/garage-api";
import { saveNavigationFeedback } from "../../../../lib/navigation-feedback";
import styles from "./page.module.css";

export default function MaintenanceAlertPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const alertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const [retryRevision, setRetryRevision] = useState(0);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationState, setCancellationState] = useState({ error: "", pending: false });
  const [requestState, setRequestState] = useState({
    alert: null,
    category: "",
    error: "",
    loading: true,
    notFound: false,
    readOnly: false,
    serviceTypes: [],
    vehicleYear: null,
  });

  useEffect(() => {
    let active = true;

    async function loadAlert() {
      setRequestState((current) => ({ ...current, error: "", loading: true, notFound: false }));
      try {
        const [alert, loadedServiceTypes, vehicle] = await Promise.all([
          getMaintenanceAlert(vehicleId, alertId),
          listServiceTypes(),
          getVehicle(vehicleId),
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
            vehicleYear: vehicle.year,
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
            vehicleYear: null,
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
    saveNavigationFeedback("Alerta de manutenção atualizado com sucesso.");
    router.push(`/garagem/${vehicleId}`);
  };

  const cancelAlert = async () => {
    if (cancellationState.pending) return;
    setCancellationState({ error: "", pending: true });

    try {
      await updateMaintenanceAlert(vehicleId, alertId, { status: "cancelled" });
      saveNavigationFeedback("Alerta de manutenção cancelado.");
      router.replace(`/garagem/${vehicleId}`);
    } catch (error) {
      setCancellationState({
        error: getMaintenanceAlertErrorMessage(
          error,
          "Não foi possível cancelar o alerta. Tente novamente.",
        ),
        pending: false,
      });
    }
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
        <>
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
            vehicleYear={requestState.vehicleYear}
          />

          {!requestState.readOnly && (
            <section className={`app-card ${styles.cancellationCard}`}>
              <div className={styles.cancellationHeading}>
                <XCircle aria-hidden size={25} weight="duotone" />
                <div>
                  <h2>Cancelar alerta</h2>
                  <p>O alerta sairá da lista de manutenções pendentes.</p>
                </div>
              </div>

              {cancellationOpen ? (
                <div className={styles.cancellationConfirmation}>
                  <p>Deseja realmente cancelar este alerta?</p>
                  {cancellationState.error && (
                    <p className="app-feedback app-feedback--error" role="alert">
                      <WarningCircle aria-hidden size={18} weight="fill" />
                      {cancellationState.error}
                    </p>
                  )}
                  <div className={styles.cancellationActions}>
                    <ActionButton
                      disabled={cancellationState.pending}
                      onClick={() => void cancelAlert()}
                      type="button"
                      variant="danger"
                    >
                      {cancellationState.pending ? "Cancelando..." : "Confirmar cancelamento"}
                    </ActionButton>
                    <ActionButton
                      disabled={cancellationState.pending}
                      onClick={() => {
                        setCancellationOpen(false);
                        setCancellationState({ error: "", pending: false });
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Manter alerta
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <ActionButton onClick={() => setCancellationOpen(true)} type="button" variant="secondary">
                  Cancelar alerta
                </ActionButton>
              )}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
