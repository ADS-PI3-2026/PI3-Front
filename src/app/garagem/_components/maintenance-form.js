"use client";

import { useState } from "react";
import {
  CaretDown,
  CircleNotch,
  FloppyDisk,
  Gauge,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import SegmentedControl from "../../components/segmented-control";
import {
  getMaintenanceAlertErrorMessage,
  getMaintenanceAlertFieldErrors,
  getMaintenanceErrorMessage,
  getMaintenanceFieldErrors,
} from "../_lib/garage-api";
import {
  formatCurrencyInput,
  onlyDigits,
  toDateInputValue,
  validateMaintenanceForm,
} from "../_lib/garage-validation";
import FileUploadField from "./file-upload-field";
import styles from "./maintenance-form.module.css";

const statusOptions = ["Realizada", "A realizar"];
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const acceptedAttachmentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

const emptyForm = {
  status: "Realizada",
  category: "",
  mileage: "",
  mileageDue: "",
  date: "",
  description: "",
  value: "",
  receiptName: "",
};

function DynamicField({ disabled, error, field, onChange, value }) {
  const errorId = `dynamic-${field.id}-error`;
  const descriptionId = field.description ? `dynamic-${field.id}-description` : undefined;
  const describedBy = [descriptionId, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const label = `${field.label}${field.required ? " *" : ""}`;

  if (field.type === "boolean") {
    return (
      <label className="app-field">
        <span>{label}</span>
        <span className={`app-control-shell ${styles.selectShell}`} data-error={Boolean(error)}>
          <select
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            value={value ?? ""}
          >
            <option value="">Selecione</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
          <CaretDown aria-hidden size={18} weight="bold" />
        </span>
        {field.description && <small id={descriptionId}>{field.description}</small>}
        {error && <small className="app-error-text" id={errorId}>{error}</small>}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="app-field">
        <span>{label}</span>
        <span className={`app-control-shell ${styles.selectShell}`} data-error={Boolean(error)}>
          <select
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            value={value ?? ""}
          >
            <option value="">Selecione</option>
            {field.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <CaretDown aria-hidden size={18} weight="bold" />
        </span>
        {field.description && <small id={descriptionId}>{field.description}</small>}
        {error && <small className="app-error-text" id={errorId}>{error}</small>}
      </label>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className={styles.dynamicChoiceField}>
        <legend>{label}</legend>
        <div className={styles.choiceList}>
          {field.options.map((option) => (
            <label key={option}>
              <input
                checked={value === option}
                disabled={disabled}
                name={`payload-${field.name}`}
                onChange={() => onChange(option)}
                type="radio"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {field.description && <small id={descriptionId}>{field.description}</small>}
        {error && <small className="app-error-text" id={errorId}>{error}</small>}
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <fieldset className={styles.dynamicChoiceField}>
        <legend>{label}</legend>
        <div className={styles.choiceList}>
          {field.options.map((option) => (
            <label key={option}>
              <input
                checked={selectedValues.includes(option)}
                disabled={disabled}
                onChange={(event) => onChange(
                  event.target.checked
                    ? [...selectedValues, option]
                    : selectedValues.filter((item) => item !== option),
                )}
                type="checkbox"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {field.description && <small id={descriptionId}>{field.description}</small>}
        {error && <small className="app-error-text" id={errorId}>{error}</small>}
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="app-field">
        <span>{label}</span>
        <textarea
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="app-control"
          data-error={Boolean(error)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          value={value ?? ""}
        />
        {field.description && <small id={descriptionId}>{field.description}</small>}
        {error && <small className="app-error-text" id={errorId}>{error}</small>}
      </label>
    );
  }

  const numeric = ["number", "numeric", "decimal", "currency", "integer"].includes(field.type);
  return (
    <label className="app-field">
      <span>{label}</span>
      <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(error)}>
        <input
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          inputMode={numeric ? "decimal" : undefined}
          onChange={(event) => onChange(event.target.value)}
          type={field.type === "date" ? "date" : "text"}
          value={value ?? ""}
        />
      </span>
      {field.description && <small id={descriptionId}>{field.description}</small>}
      {error && <small className="app-error-text" id={errorId}>{error}</small>}
    </label>
  );
}

function isAcceptedAttachment(file) {
  if (acceptedAttachmentTypes.has(file.type)) return true;
  return /\.(jpe?g|png|pdf)$/i.test(file.name);
}

function getAttachmentError(files) {
  if (files.length > MAX_ATTACHMENTS) {
    return "Selecione no máximo cinco comprovantes.";
  }
  if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE)) {
    return "Cada comprovante deve ter no máximo 10 MB.";
  }
  if (files.some((file) => !isAcceptedAttachment(file))) {
    return "Envie somente arquivos JPG, PNG ou PDF.";
  }
  return "";
}

export default function MaintenanceForm({
  alertOnly = false,
  completedOnly = false,
  alertSubmitLabel,
  completionSubmitLabel,
  fields = [],
  fieldsError = "",
  fieldsLoading = false,
  initialValues = {},
  intro,
  onCategoryChange,
  onSubmit,
  readOnly = false,
  serviceTypes = [],
  submitLabel,
  title,
}) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...initialValues,
    status: alertOnly ? "A realizar" : initialValues.status ?? emptyForm.status,
    date: toDateInputValue(initialValues.date),
    value: initialValues.value === undefined || initialValues.value === ""
      ? ""
      : formatCurrencyInput(initialValues.value),
  }));
  const [fieldValues, setFieldValues] = useState({});
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setSubmitError("");
    setErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateCategory = (identifier) => {
    updateField("category", identifier);
    setFieldValues({});
    setErrors((current) => {
      const nextErrors = {};
      for (const [key, value] of Object.entries(current)) {
        if (!key.startsWith("payload.")) nextErrors[key] = value;
      }
      return nextErrors;
    });
    onCategoryChange?.(identifier);
  };

  const updateDynamicField = (fieldName, value) => {
    setSubmitError("");
    setErrors((current) => ({ ...current, [`payload.${fieldName}`]: "" }));
    setFieldValues((current) => ({ ...current, [fieldName]: value }));
  };

  const submitMaintenance = async (event) => {
    event.preventDefault();
    if (readOnly || submitting || fieldsLoading) return;

    const validationErrors = validateMaintenanceForm(form, fields, fieldValues);
    const attachmentError = getAttachmentError(receiptFiles);
    if (attachmentError) validationErrors.receipt = attachmentError;

    setErrors(validationErrors);
    setSubmitError("");
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit?.({ fieldValues, files: receiptFiles, form });
    } catch (error) {
      const isAlert = form.status === "A realizar";
      setErrors(isAlert
        ? getMaintenanceAlertFieldErrors(error)
        : getMaintenanceFieldErrors(error));
      if (error?.maintenanceCreated) setSubmissionCompleted(true);
      setSubmitError(isAlert
        ? getMaintenanceAlertErrorMessage(
          error,
          "Não foi possível registrar o alerta. Tente novamente.",
        )
        : getMaintenanceErrorMessage(
          error,
          "Não foi possível registrar a manutenção. Tente novamente.",
        ));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedServiceType = serviceTypes.find((serviceType) => (
    serviceType.identifier === form.category
  ));

  return (
    <main className={`app-form-screen ${styles.formScreen}`}>
      <div className="app-form-heading">
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>

      <form className={`app-form-card ${styles.maintenanceForm}`} noValidate onSubmit={submitMaintenance}>
        {!completedOnly && !alertOnly && (
          <fieldset className={styles.statusField} disabled={submitting || readOnly}>
            <legend>Status do Serviço</legend>
            <SegmentedControl
              ariaLabel="Status do serviço"
              onChange={(status) => updateField("status", status)}
              options={statusOptions.map((status) => ({ label: status, value: status }))}
              value={form.status}
            />
            {errors.status && <small className="app-error-text">{errors.status}</small>}
          </fieldset>
        )}

        <label className="app-field">
          <span>Categoria</span>
          <span className={`app-control-shell ${styles.selectShell}`} data-error={Boolean(errors.category)}>
            <select
              disabled={submitting || readOnly || serviceTypes.length === 0}
              value={form.category}
              onChange={(event) => updateCategory(event.target.value)}
            >
              <option value="">Selecione uma categoria</option>
              {serviceTypes.map((serviceType) => (
                <option key={serviceType.identifier} value={serviceType.identifier}>
                  {serviceType.name}
                </option>
              ))}
            </select>
            <CaretDown aria-hidden size={18} weight="bold" />
          </span>
          {selectedServiceType?.description && <small>{selectedServiceType.description}</small>}
          {errors.category && <small className="app-error-text">{errors.category}</small>}
        </label>

        {fieldsLoading && (
          <p className={styles.loadingFields} role="status">
            <CircleNotch aria-hidden size={18} weight="bold" />
            {form.status === "Realizada"
              ? "Carregando detalhes do serviço..."
              : "Preparando categoria do alerta..."}
          </p>
        )}

        {fieldsError && (
          <p className="app-feedback app-feedback--error" role="alert">{fieldsError}</p>
        )}

        {form.status === "Realizada" && !fieldsLoading && fields.map((field) => (
          <DynamicField
            disabled={submitting || readOnly}
            error={errors[`payload.${field.name}`]}
            field={field}
            key={field.id}
            onChange={(value) => updateDynamicField(field.name, value)}
            value={fieldValues[field.name]}
          />
        ))}

        {form.status === "Realizada" && (
          <label className="app-field">
            <span>Quilometragem no serviço (km)</span>
            <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(errors.mileage)}>
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                disabled={submitting || readOnly}
                inputMode="numeric"
                name="mileage"
                onChange={(event) => updateField("mileage", onlyDigits(event.target.value))}
                placeholder="Ex: 45000"
                value={form.mileage}
              />
            </span>
            {errors.mileage && <small className="app-error-text">{errors.mileage}</small>}
          </label>
        )}

        <label className="app-field">
          <span>{form.status === "Realizada" ? "Data da realização" : "Data prevista (opcional)"}</span>
          <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(errors.date)}>
            <input
              disabled={submitting || readOnly}
              name="date"
              onChange={(event) => updateField("date", event.target.value)}
              type="date"
              value={form.date}
            />
          </span>
          {errors.date && <small className="app-error-text">{errors.date}</small>}
        </label>

        {form.status === "A realizar" && (
          <label className="app-field">
            <span>Quilometragem prevista (opcional)</span>
            <span
              className={`app-control-shell ${styles.inputShell}`}
              data-error={Boolean(errors.mileageDue || errors.deadline)}
            >
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                disabled={submitting || readOnly}
                inputMode="numeric"
                name="mileageDue"
                onChange={(event) => updateField("mileageDue", onlyDigits(event.target.value))}
                placeholder="Ex: 50000"
                value={form.mileageDue}
              />
            </span>
            <small>Informe a data, a quilometragem ou ambas.</small>
            {errors.mileageDue && <small className="app-error-text">{errors.mileageDue}</small>}
            {errors.deadline && <small className="app-error-text">{errors.deadline}</small>}
          </label>
        )}

        <label className="app-field">
          <span>
            {form.status === "Realizada"
              ? "Descrição do serviço (opcional)"
              : "Descrição do alerta"}
          </span>
          <textarea
            className="app-control"
            data-error={Boolean(errors.description)}
            disabled={submitting || readOnly}
            maxLength={500}
            name="description"
            onChange={(event) => updateField("description", event.target.value)}
            placeholder={form.status === "Realizada"
              ? "Detalhes das peças trocadas ou serviços executados..."
              : "Descreva o serviço que deverá ser realizado..."}
            rows={4}
            value={form.description}
          />
          {errors.description && <small className="app-error-text">{errors.description}</small>}
        </label>

        {form.status === "Realizada" && (
          <>
            <label className="app-field">
              <span>Valor (R$)</span>
              <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(errors.value)}>
                <input
                  disabled={submitting || readOnly}
                  inputMode="decimal"
                  name="value"
                  onChange={(event) => updateField(
                    "value",
                    formatCurrencyInput(
                      event.target.value,
                      form.value,
                      event.nativeEvent?.inputType?.startsWith("delete"),
                    ),
                  )}
                  placeholder="R$ 0,00"
                  type="text"
                  value={form.value}
                />
              </span>
              {errors.value && <small className="app-error-text">{errors.value}</small>}
            </label>

            <FileUploadField
              accept=".png,.jpg,.jpeg,.pdf"
              compact
              disabled={submitting || readOnly}
              error={errors.receipt}
              hint="Até 5 arquivos JPG, PNG ou PDF (máx. 10 MB cada)"
              label="Comprovantes (opcional)"
              maxFiles={MAX_ATTACHMENTS}
              maxFileSize={MAX_ATTACHMENT_SIZE}
              multiple
              name="receipts"
              onChange={(value, files) => {
                updateField("receiptName", value);
                setErrors((current) => ({
                  ...current,
                  receipt: getAttachmentError(files),
                }));
                setReceiptFiles(files);
              }}
              selectedFiles={receiptFiles}
              value={form.receiptName || "Anexar comprovantes"}
            />
          </>
        )}

        {submitError && (
          <p className="app-feedback app-feedback--error" role="alert">{submitError}</p>
        )}

        {!readOnly && (
          <ActionButton
            disabled={submitting || submissionCompleted || fieldsLoading || Boolean(fieldsError) || !form.category}
            type="submit"
          >
            {submitting
              ? <CircleNotch aria-hidden className={styles.loadingIcon} size={21} weight="bold" />
              : <FloppyDisk aria-hidden size={21} weight="bold" />}
            {submissionCompleted
              ? "Manutenção registrada"
              : submitting
              ? "Salvando..."
              : form.status === "A realizar" && alertSubmitLabel
                ? alertSubmitLabel
              : form.status === "Realizada" && completionSubmitLabel
                ? completionSubmitLabel
                : submitLabel}
          </ActionButton>
        )}
      </form>
    </main>
  );
}
