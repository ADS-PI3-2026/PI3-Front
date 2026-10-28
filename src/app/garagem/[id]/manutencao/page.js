"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import AppShell from "../../../components/app-shell";
import MaintenanceForm from "../../_components/maintenance-form";
import PageTopBar from "../../_components/page-top-bar";
import {
  buildMaintenanceAlertPayload,
  buildMaintenancePayload,
  createMaintenanceAlert,
  createMaintenance,
  getServiceTypeFields,
  getVehicle,
  listServiceTypes,
  uploadMaintenanceAttachments,
} from "../../_lib/garage-api";
import { getAuthErrorMessage } from "../../../auth-api";

export default function NewMaintenancePage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fieldRequest = useRef(0);
  const [retryRevision, setRetryRevision] = useState(0);
  const [requestState, setRequestState] = useState({
    error: "",
    loading: true,
    notFound: false,
    serviceTypes: [],
    vehicle: null,
  });
  const [fieldsState, setFieldsState] = useState({
    error: "",
    fields: [],
    loading: false,
  });

  useEffect(() => {
    let active = true;

    async function loadFormData() {
      setRequestState((current) => ({ ...current, error: "", loading: true, notFound: false }));
      try {
        const [vehicle, serviceTypes] = await Promise.all([
          getVehicle(vehicleId),
          listServiceTypes(),
        ]);
        if (active) {
          setRequestState({
            error: "",
            loading: false,
            notFound: false,
            serviceTypes,
            vehicle,
          });
        }
      } catch (error) {
        if (active) {
          setRequestState({
            error: getAuthErrorMessage(
              error,
              "Não foi possível carregar o formulário de manutenção. Tente novamente.",
            ),
            loading: false,
            notFound: error?.status === 404,
            serviceTypes: [],
            vehicle: null,
          });
        }
      }
    }

    void loadFormData();
    return () => { active = false; };
  }, [retryRevision, vehicleId]);

  const loadServiceFields = async (identifier) => {
    const requestId = fieldRequest.current + 1;
    fieldRequest.current = requestId;

    if (!identifier) {
      setFieldsState({ error: "", fields: [], loading: false });
      return;
    }

    setFieldsState({ error: "", fields: [], loading: true });
    try {
      const fields = await getServiceTypeFields(identifier);
      if (fieldRequest.current === requestId) {
        setFieldsState({ error: "", fields, loading: false });
      }
    } catch (error) {
      if (fieldRequest.current === requestId) {
        setFieldsState({
          error: getAuthErrorMessage(
            error,
            "Não foi possível carregar os detalhes dessa categoria. Tente selecioná-la novamente.",
          ),
          fields: [],
          loading: false,
        });
      }
    }
  };

  const submitService = async ({ fieldValues, files, form }) => {
    const serviceType = requestState.serviceTypes.find((item) => (
      item.identifier === form.category
    ));

    if (form.status === "A realizar") {
      const payload = buildMaintenanceAlertPayload({
        fields: fieldsState.fields,
        form,
        serviceType,
      });
      await createMaintenanceAlert(vehicleId, payload);
      router.push(`/garagem/${vehicleId}`);
      return;
    }

    const payload = buildMaintenancePayload({
      fieldValues,
      fields: fieldsState.fields,
      form,
      serviceType,
      vehicleId,
    });
    const createdMaintenances = await createMaintenance(payload);
    const maintenanceId = Number(createdMaintenances[0]?.id);

    if (!Number.isInteger(maintenanceId) || maintenanceId <= 0) {
      const error = new Error("A manutenção foi registrada, mas a resposta do serviço está incompleta.");
      error.maintenanceCreated = true;
      throw error;
    }

    if (files.length > 0) {
      try {
        await uploadMaintenanceAttachments(maintenanceId, files);
      } catch {
        const error = new Error(
          "A manutenção foi registrada, mas não foi possível enviar os comprovantes. Evite salvar novamente.",
        );
        error.maintenanceCreated = true;
        throw error;
      }
    }

    router.push(`/garagem/${vehicleId}`);
  };

  return (
    <AppShell>
      <PageTopBar title="Registrar manutenção" />

      {requestState.loading ? (
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden size={25} weight="bold" />
          <p>Carregando formulário de manutenção...</p>
        </section>
      ) : !requestState.vehicle ? (
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>{requestState.notFound ? "Veículo não encontrado" : "Não foi possível carregar o formulário"}</h2>
          <p>{requestState.error}</p>
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
      ) : (
        <MaintenanceForm
          alertSubmitLabel="Salvar alerta"
          fields={fieldsState.fields}
          fieldsError={fieldsState.error}
          fieldsLoading={fieldsState.loading}
          intro={`Registre um serviço realizado ou programe um alerta para o ${requestState.vehicle.model}, placa ${requestState.vehicle.plate}.`}
          onCategoryChange={loadServiceFields}
          onSubmit={submitService}
          serviceTypes={requestState.serviceTypes}
          submitLabel="Salvar manutenção"
          title="Registro de manutenção"
        />
      )}
    </AppShell>
  );
}
