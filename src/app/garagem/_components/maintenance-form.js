"use client";

import { useState } from "react";
import {
  CalendarBlank,
  CaretDown,
  FloppyDisk,
  Gauge,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
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

export default function MaintenanceForm({ initialValues = {}, intro, submitLabel, title }) {
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
    <main className={styles.formScreen}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>

      <form className={styles.maintenanceForm} noValidate onSubmit={submitMaintenance}>
        <fieldset className={styles.statusField}>
          <legend>Status do Serviço</legend>
          <div className={styles.statusToggle}>
            {statusOptions.map((status) => (
              <button
                aria-pressed={form.status === status}
                className={form.status === status ? styles.statusActive : styles.statusButton}
                key={status}
                onClick={() => updateField("status", status)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
          {errors.status && <small className={styles.errorText}>{errors.status}</small>}
        </fieldset>

        <label className={styles.field}>
          <span>Categoria</span>
          <span className={styles.selectShell} data-error={Boolean(errors.category)}>
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              <option value="">Selecione uma categoria</option>
              {maintenanceCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <CaretDown aria-hidden size={18} weight="bold" />
          </span>
          {errors.category && <small className={styles.errorText}>{errors.category}</small>}
        </label>

        <label className={styles.field}>
          <span>Quilometragem (km)</span>
          <span className={styles.inputShell} data-error={Boolean(errors.mileage)}>
            <Gauge aria-hidden size={20} weight="regular" />
            <input
              inputMode="numeric"
              name="mileage"
              onChange={(event) => updateField("mileage", onlyDigits(event.target.value))}
              placeholder="Ex: 45000"
              value={form.mileage}
            />
          </span>
          {errors.mileage && <small className={styles.errorText}>{errors.mileage}</small>}
        </label>

        <label className={styles.field}>
          <span>Data</span>
          <span className={styles.inputShell} data-error={Boolean(errors.date)}>
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
          {errors.date && <small className={styles.errorText}>{errors.date}</small>}
        </label>

        <label className={styles.field}>
          <span>Descrição do Serviço</span>
          <textarea
            data-error={Boolean(errors.description)}
            name="description"
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Detalhes das peças trocadas ou serviços executados..."
            rows={4}
            value={form.description}
          />
          {errors.description && <small className={styles.errorText}>{errors.description}</small>}
        </label>

        <label className={styles.field}>
          <span>Valor (R$)</span>
          <span className={styles.inputShell} data-error={Boolean(errors.value)}>
            <input
              inputMode="decimal"
              name="value"
              onChange={(event) => updateField("value", event.target.value)}
              placeholder="R$ 0,00"
              value={form.value}
            />
          </span>
          {errors.value && <small className={styles.errorText}>{errors.value}</small>}
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

        <ActionButton type="submit">
          <FloppyDisk aria-hidden size={21} weight="bold" />
          {submitLabel}
        </ActionButton>
      </form>
    </main>
  );
}
