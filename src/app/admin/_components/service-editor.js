"use client";

import { useEffect, useState } from "react";
import ActionButton from "../../components/action-button";
import {
  getAdminErrorMessage,
  getAdminFieldErrors,
  saveAdminServiceType,
} from "../admin-api";
import { Feedback, Field } from "./admin-ui";
import {
  buildServicePayload,
  createServiceDraft,
  getServiceIdentifierError,
  reconcileServiceDraft,
} from "../_lib/admin-forms";
import styles from "../admin.module.css";

export default function ServiceEditor({
  service,
  onSaved,
  onCancel,
  onBusyChange,
}) {
  const [state, setState] = useState(() => {
    const initial = createServiceDraft(service);
    return { initial, form: initial };
  });
  const { initial, form } = state;
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!service) return;
    let active = true;
    queueMicrotask(() => {
      if (active)
        setState((current) => reconcileServiceDraft(current, service));
    });
    return () => {
      active = false;
    };
  }, [service]);

  const change = (event) => {
    const { name, value } = event.target;
    setState((current) => ({
      ...current,
      form: { ...current.form, [name]: value },
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {};
    if (!form.name.trim())
      nextErrors.name = "Informe o nome do tipo de serviço.";
    if (!service) {
      const identifierError = getServiceIdentifierError(form.identifier);
      if (identifierError) nextErrors.identifier = identifierError;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const payload = buildServicePayload(form, service ? initial : null);
    if (!Object.keys(payload).length) return;
    setBusy(true);
    onBusyChange?.(true);
    setMessage("");
    try {
      const saved = await saveAdminServiceType(service?.identifier, payload);
      const savedForm = createServiceDraft(saved);
      setState({ initial: savedForm, form: savedForm });
      onSaved(saved);
    } catch (error) {
      setErrors(getAdminFieldErrors(error));
      setMessage(getAdminErrorMessage(error));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <Field
        disabled={busy}
        error={errors.name}
        label="Nome do tipo de serviço"
        maxLength={255}
        name="name"
        onChange={change}
        required
        value={form.name}
      />
      <Field
        disabled={busy || Boolean(service)}
        error={errors.identifier}
        hint={
          service
            ? "O identificador é permanente."
            : "Exemplo · revisao_preventiva"
        }
        label="Identificador"
        maxLength={255}
        name="identifier"
        onChange={change}
        required
        value={form.identifier}
      />
      <Field
        as="textarea"
        disabled={busy}
        error={errors.description}
        label="Descrição (opcional)"
        name="description"
        onChange={change}
        rows={4}
        value={form.description}
      />
      <label className={styles.check}>
        <input
          checked={form.is_active}
          disabled={busy}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              form: { ...current.form, is_active: event.target.checked },
            }))
          }
          type="checkbox"
        />
        Disponível para novas manutenções
      </label>
      <Feedback error message={message} />
      <div className={styles.actions}>
        {onCancel && (
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        )}
        <ActionButton
          className={styles.compactButton}
          disabled={
            busy ||
            (Boolean(service) &&
              !Object.keys(buildServicePayload(form, initial)).length)
          }
          type="submit"
        >
          {busy
            ? "Salvando…"
            : service
              ? "Salvar alterações"
              : "Cadastrar tipo de serviço"}
        </ActionButton>
      </div>
    </form>
  );
}
