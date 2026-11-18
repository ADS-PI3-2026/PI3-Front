"use client";

import { useState } from "react";
import ActionButton from "../../components/action-button";
import {
  getAdminErrorMessage,
  getAdminFieldErrors,
  saveServiceField,
} from "../admin-api";
import { Feedback, Field, Modal } from "./admin-ui";
import {
  buildServiceFieldPayload,
  createServiceFieldDraft,
  validateServiceField,
} from "../_lib/admin-forms";
import styles from "../admin.module.css";

export const fieldTypes = [
  ["text", "Texto curto"],
  ["textarea", "Texto longo"],
  ["number", "Número"],
  ["date", "Data"],
  ["boolean", "Sim ou não"],
  ["select", "Lista de opções"],
  ["radio", "Escolha única"],
  ["checkbox", "Múltiplas escolhas"],
];

export default function FieldEditor({
  identifier,
  field,
  fields,
  onClose,
  onSaved,
}) {
  const [initial] = useState(() => createServiceFieldDraft(field, fields));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const choiceType = ["select", "radio", "checkbox"].includes(form.field_type);
  const knownType = fieldTypes.some(([value]) => value === form.field_type);
  const dependencies = fields.filter((item) => item.id !== field?.id);
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateServiceField(form, fields, field?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const values = buildServiceFieldPayload(form, field ? initial : null);
    if (!Object.keys(values).length) {
      onClose();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await saveServiceField(identifier, field?.id, values);
      onSaved(field ? "Campo atualizado." : "Campo cadastrado.");
    } catch (error) {
      setErrors(getAdminFieldErrors(error));
      setMessage(getAdminErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      busy={busy}
      onClose={onClose}
      title={field ? "Editar campo" : "Novo campo"}
      wide
    >
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.formColumns}>
          <Field
            disabled={busy}
            error={errors.display_name}
            label="Nome exibido no formulário"
            maxLength={255}
            name="display_name"
            onChange={change}
            required
            value={form.display_name}
          />
          <Field
            disabled={busy || Boolean(field)}
            error={errors.name}
            hint={
              field ? "O identificador é permanente." : "Exemplo · marca_oleo"
            }
            label="Identificador do campo"
            maxLength={255}
            name="name"
            onChange={change}
            required
            value={form.name}
          />
          <Field
            as="select"
            disabled={busy}
            error={errors.field_type}
            label="Tipo de campo"
            name="field_type"
            onChange={change}
            value={form.field_type}
          >
            {!knownType && (
              <option value={form.field_type}>
                {form.field_type} · tipo existente
              </option>
            )}
            {fieldTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Field>
          <Field
            disabled={busy}
            error={errors.order}
            label="Ordem de exibição"
            min="0"
            name="order"
            onChange={change}
            required
            step="1"
            type="number"
            value={form.order}
          />
        </div>
        <Field
          as="textarea"
          disabled={busy}
          error={errors.description}
          label="Texto de ajuda (opcional)"
          maxLength={255}
          name="description"
          onChange={change}
          rows={2}
          value={form.description}
        />
        {choiceType && (
          <Field
            as="textarea"
            disabled={busy}
            error={errors.options}
            hint="Uma opção por linha."
            label="Opções disponíveis"
            name="options"
            onChange={change}
            rows={4}
            value={form.options}
          />
        )}
        <label className={styles.check}>
          <input
            checked={form.required}
            disabled={busy}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                required: event.target.checked,
              }))
            }
            type="checkbox"
          />
          Preenchimento sempre obrigatório
        </label>
        <Field
          as="select"
          disabled={busy || form.required}
          error={errors.required_if_field_filled}
          hint="O campo será exigido quando o campo escolhido tiver um valor ou estiver marcado."
          label="Obrigatório quando outro campo for preenchido"
          name="required_if_field_filled"
          onChange={change}
          value={form.required_if_field_filled}
        >
          <option value="">Sem condição</option>
          {form.required_if_field_filled &&
            !dependencies.some(
              (item) => item.name === form.required_if_field_filled,
            ) && (
              <option value={form.required_if_field_filled}>
                {form.required_if_field_filled} · referência existente
              </option>
            )}
          {dependencies.map((item) => (
            <option key={item.id} value={item.name}>
              {item.display_name}
            </option>
          ))}
        </Field>
        <Feedback error message={message} />
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <ActionButton
            className={styles.compactButton}
            disabled={busy}
            type="submit"
          >
            {busy ? "Salvando…" : field ? "Salvar campo" : "Cadastrar campo"}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
