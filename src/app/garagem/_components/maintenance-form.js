"use client";

import { useState } from "react";
import {
  CalendarBlank,
  CaretDown,
  FloppyDisk,
  Gauge,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import SegmentedControl from "../../components/segmented-control";
import { maintenanceCategories } from "../../mock-data";
import { onlyDigits, validateMaintenanceForm } from "../_lib/garage-validation";
import FileUploadField from "./file-upload-field";
import styles from "./maintenance-form.module.css";

const statusOptions = ["Realizada", "A realizar"];

const emptyForm = {
  status: "Realizada",
  category: "",
  mileage: "",
  date: "",
  description: "",
  value: "",
  receiptName: "",
};

export default function MaintenanceForm({
  completionSubmitLabel,
  initialValues = {},
  intro,
  submitLabel,
  title,
}) {
  const [form, setForm] = useState({ ...emptyForm, ...initialValues });
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitMaintenance = (event) => {
    event.preventDefault();
    setErrors(validateMaintenanceForm(form));
  };

  return (
    <main className={`app-form-screen ${styles.formScreen}`}>
      <div className="app-form-heading">
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>

      <form className={`app-form-card ${styles.maintenanceForm}`} noValidate onSubmit={submitMaintenance}>
        <fieldset className={styles.statusField}>
          <legend>Status do Serviço</legend>
          <SegmentedControl
            ariaLabel="Status do serviço"
            onChange={(status) => updateField("status", status)}
            options={statusOptions.map((status) => ({ label: status, value: status }))}
            value={form.status}
          />
          {errors.status && <small className="app-error-text">{errors.status}</small>}
        </fieldset>

        <label className="app-field">
          <span>Categoria</span>
          <span className={`app-control-shell ${styles.selectShell}`} data-error={Boolean(errors.category)}>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              <option value="">Selecione uma categoria</option>
              {maintenanceCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <CaretDown aria-hidden size={18} weight="bold" />
          </span>
          {errors.category && <small className="app-error-text">{errors.category}</small>}
        </label>

        {form.status === "Realizada" && (
          <label className="app-field">
            <span>Quilometragem no serviço (km)</span>
            <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(errors.mileage)}>
              <Gauge aria-hidden size={20} weight="regular" />
              <input
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
          <span>{form.status === "Realizada" ? "Data da realização" : "Prazo previsto"}</span>
          <span className={`app-control-shell ${styles.inputShell}`} data-error={Boolean(errors.date)}>
            <input
              inputMode="numeric"
              maxLength={10}
              name="date"
              onChange={(event) => updateField("date", event.target.value)}
              placeholder="dd/mm/aaaa"
              value={form.date}
            />
            <CalendarBlank aria-hidden size={20} weight="bold" />
          </span>
          {errors.date && <small className="app-error-text">{errors.date}</small>}
        </label>

        <label className="app-field">
          <span>Descrição do Serviço</span>
          <textarea
            className="app-control"
            data-error={Boolean(errors.description)}
            name="description"
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Detalhes das peças trocadas ou serviços executados..."
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
                  inputMode="decimal"
                  name="value"
                  onChange={(event) => updateField("value", event.target.value)}
                  placeholder="R$ 0,00"
                  value={form.value}
                />
              </span>
              {errors.value && <small className="app-error-text">{errors.value}</small>}
            </label>

            <FileUploadField
              accept=".png,.jpg,.jpeg,.pdf"
              compact
              hint="Formatos suportados: JPG, PNG, PDF (Máx. 5MB)"
              label="Comprovante"
              name="receipt"
              onChange={(value) => updateField("receiptName", value)}
              value={form.receiptName || "Anexar Comprovante"}
            />
          </>
        )}

        <ActionButton type="submit">
          <FloppyDisk aria-hidden size={21} weight="bold" />
          {form.status === "Realizada" && completionSubmitLabel
            ? completionSubmitLabel
            : submitLabel}
        </ActionButton>
      </form>
    </main>
  );
}
