"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  WarningCircleIcon,
} from "@phosphor-icons/react";
import ActionButton from "../../../../components/action-button";
import AppShell from "../../../../components/app-shell";
import { getAuthSession } from "../../../../auth-session";
import { getAuthErrorMessage } from "../../../../auth-api";
import MaintenanceForm from "../../../_components/maintenance-form";
import PageTopBar from "../../../_components/page-top-bar";
import PageLoadingState from "../../../_components/page-loading-state";
import {
  buildMaintenanceAlertPayload,
  buildMaintenancePayload,
  createMaintenance,
  getMaintenanceAlert,
  getMaintenanceAlertErrorMessage,
  getServiceTypeFields,
  getVehicle,
  listServiceTypes,
  resolveServiceTypeIds,
  updateMaintenanceAlert,
  uploadMaintenanceAttachments,
} from "../../../_lib/garage-api";
import { saveNavigationFeedback } from "../../../../lib/navigation-feedback";
import styles from "./page.module.css";

const COMPLETION_STORAGE_PREFIX = "legadocar:alert-completion";

function getCompletionStorageKey(vehicleId, alertId) {
  return `${COMPLETION_STORAGE_PREFIX}:vehicle-${vehicleId}:alert-${alertId}`;
}

function readPendingCompletion(vehicleId, alertId) {
  try {
    const key = getCompletionStorageKey(vehicleId, alertId);
    const entry = JSON.parse(window.sessionStorage.getItem(key));
    const sessionId = getAuthSession()?.sessionId;
    const maintenanceId = Number(entry?.maintenanceId);
    if (!sessionId || entry?.sessionId !== sessionId
      || !Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return maintenanceId;
  } catch {
    return null;
  }
}

function savePendingCompletion(vehicleId, alertId, maintenanceId) {
  try {
    const sessionId = getAuthSession()?.sessionId;
    if (!sessionId) return;
    window.sessionStorage.setItem(
      getCompletionStorageKey(vehicleId, alertId),
      JSON.stringify({ maintenanceId, sessionId }),
    );
  } catch {
    // A conclusão ainda pode ser repetida enquanto a página permanecer aberta.
  }
}

function clearPendingCompletion(vehicleId, alertId) {
  try {
    window.sessionStorage.removeItem(getCompletionStorageKey(vehicleId, alertId));
  } catch {
    // O vínculo no backend já foi concluído, mesmo sem acesso ao armazenamento.
  }
}

export default function MaintenanceAlertPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const alertId = Array.isArray(params.alertId) ? params.alertId[0] : params.alertId;
  const completionFieldRequest = useRef(0);
  const [retryRevision, setRetryRevision] = useState(0);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionState, setCompletionState] = useState({
    fields: [],
    fieldsError: "",
    fieldsLoading: false,
    linkError: "",
    linking: false,
    maintenanceId: null,
  });
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

  const loadCompletionFields = useCallback(async (identifier) => {
    const requestId = completionFieldRequest.current + 1;
    completionFieldRequest.current = requestId;

    if (!identifier) {
      setCompletionState((current) => ({
        ...current,
        fields: [],
        fieldsError: "",
        fieldsLoading: false,
      }));
      return;
    }

    setCompletionState((current) => ({
      ...current,
      fields: [],
      fieldsError: "",
      fieldsLoading: true,
    }));
    try {
      const fields = await getServiceTypeFields(identifier);
      if (completionFieldRequest.current === requestId) {
        setCompletionState((current) => ({
          ...current,
          fields,
          fieldsError: "",
          fieldsLoading: false,
        }));
      }
    } catch (error) {
      if (completionFieldRequest.current === requestId) {
        setCompletionState((current) => ({
          ...current,
          fields: [],
          fieldsError: getAuthErrorMessage(
            error,
            "Não foi possível carregar os detalhes dessa categoria. Tente novamente.",
          ),
          fieldsLoading: false,
        }));
      }
    }
  }, []);

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
        const pendingMaintenanceId = alert.status === "pending"
          ? readPendingCompletion(vehicleId, alertId)
          : null;
        const completionRequested = new URLSearchParams(window.location.search)
          .get("acao") === "concluir";

        if (alert.status !== "pending") clearPendingCompletion(vehicleId, alertId);

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
          setCompletionState((current) => ({
            ...current,
            maintenanceId: pendingMaintenanceId,
          }));
          if (pendingMaintenanceId || completionRequested) {
            setCompletionOpen(true);
            void loadCompletionFields(currentServiceType.identifier);
          }
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
  }, [alertId, loadCompletionFields, retryRevision, vehicleId]);

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

  const submitCompletion = async ({ fieldValues, files, form }) => {
    let maintenanceId = completionState.maintenanceId;

    if (!maintenanceId) {
      const serviceType = requestState.serviceTypes.find((item) => (
        item.identifier === form.category
      ));
      const payload = buildMaintenancePayload({
        fieldValues,
        fields: completionState.fields,
        form,
        serviceType,
        vehicleId,
      });
      const createdMaintenances = await createMaintenance(payload);
      maintenanceId = Number(createdMaintenances[0]?.id);

      if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
        const error = new Error(
          "A manutenção foi registrada, mas o serviço não informou seu identificador. Não envie o formulário novamente.",
        );
        error.maintenanceCreated = true;
        throw error;
      }

      savePendingCompletion(vehicleId, alertId, maintenanceId);
      setCompletionState((current) => ({
        ...current,
        linkError: "",
        maintenanceId,
      }));
    }

    try {
      await updateMaintenanceAlert(vehicleId, alertId, {
        maintenance_id: maintenanceId,
        status: "completed",
      });
    } catch (error) {
      setCompletionState((current) => ({
        ...current,
        linkError: getMaintenanceAlertErrorMessage(
          error,
          "Não foi possível concluir o alerta. Tente novamente.",
        ),
      }));
      throw new Error(
        "A manutenção já foi registrada, mas o alerta ainda não foi concluído. Tente novamente para repetir somente a conclusão, sem criar outra manutenção.",
      );
    }

    clearPendingCompletion(vehicleId, alertId);

    if (files.length > 0) {
      try {
        await uploadMaintenanceAttachments(maintenanceId, files);
      } catch {
        saveNavigationFeedback(
          "Alerta concluído, mas não foi possível enviar os comprovantes. Você pode adicioná-los nos detalhes da manutenção.",
        );
        router.push(`/garagem/${vehicleId}/manutencao/${maintenanceId}`);
        return;
      }
    }

    saveNavigationFeedback("Alerta concluído e manutenção registrada no histórico.");
    router.push(`/garagem/${vehicleId}`);
  };

  const retryCompletion = async () => {
    const maintenanceId = completionState.maintenanceId;
    if (!maintenanceId || completionState.linking) return;

    setCompletionState((current) => ({
      ...current,
      linkError: "",
      linking: true,
    }));
    try {
      await updateMaintenanceAlert(vehicleId, alertId, {
        maintenance_id: maintenanceId,
        status: "completed",
      });
      clearPendingCompletion(vehicleId, alertId);
      saveNavigationFeedback("Alerta concluído e manutenção mantida no histórico.");
      router.push(`/garagem/${vehicleId}`);
    } catch (error) {
      setCompletionState((current) => ({
        ...current,
        linkError: getMaintenanceAlertErrorMessage(
          error,
          "Não foi possível concluir o alerta. Tente novamente.",
        ),
        linking: false,
      }));
    }
  };

  return (
    <AppShell>
      <PageTopBar title="Alerta de manutenção" />

      {requestState.loading ? (
        <PageLoadingState message="Carregando alerta..." />
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
          {completionOpen && !requestState.readOnly ? (
            completionState.maintenanceId ? (
              <section className={styles.actionPanel}>
                <div className={styles.completionHeading}>
                  <WarningCircleIcon aria-hidden size={25} weight="duotone" />
                  <div>
                    <h2>Manutenção já registrada</h2>
                    <p>
                      Falta somente concluir o alerta. Esta tentativa não criará outra manutenção.
                      Se havia comprovantes selecionados, adicione-os depois nos detalhes da manutenção.
                    </p>
                  </div>
                </div>
                {completionState.linkError && (
                  <p className="app-feedback app-feedback--error" role="alert">
                    <WarningCircleIcon aria-hidden size={18} weight="fill" />
                    {completionState.linkError}
                  </p>
                )}
                <div className={styles.completionRecoveryActions}>
                  <ActionButton
                    disabled={completionState.linking}
                    onClick={() => void retryCompletion()}
                    type="button"
                  >
                    {completionState.linking ? "Concluindo..." : "Tentar concluir alerta novamente"}
                  </ActionButton>
                  <Link
                    className="app-empty-link"
                    href={`/garagem/${vehicleId}/manutencao/${completionState.maintenanceId}`}
                  >
                    Ver manutenção registrada
                  </Link>
                </div>
              </section>
            ) : (
              <MaintenanceForm
                completedOnly
                completionSubmitLabel="Concluir alerta"
                fields={completionState.fields}
                fieldsError={completionState.fieldsError}
                fieldsLoading={completionState.fieldsLoading}
                initialValues={{
                  category: requestState.category,
                  description: requestState.alert.description,
                  status: "Realizada",
                }}
                intro="Informe os dados do serviço realizado. A manutenção será registrada no histórico antes da conclusão do alerta."
                key={`completion-${requestState.alert.id}`}
                onCategoryChange={loadCompletionFields}
                onSubmit={submitCompletion}
                serviceTypes={requestState.serviceTypes}
                submitLabel="Concluir alerta"
                title="Registrar manutenção realizada"
                vehicleYear={requestState.vehicleYear}
              />
            )
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
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
