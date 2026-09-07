"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarBlank,
  CaretDown,
  FloppyDisk,
  Gauge,
  UploadSimple,
} from "@phosphor-icons/react";
import ActionButton from "../../../../components/action-button";
import AppShell from "../../../../components/app-shell";
import { maintenanceCategories } from "../../../../mock-data";
import styles from "./page.module.css";

const initialForm = {
  status: "Realizada",
  category: "",
  mileage: "",
  date: "",
  description: "",
  value: "",
  receiptName: "",
};

export default function NewMaintenancePage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");

  const updateField = (field, value) => {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitMaintenance = (event) => {
    event.preventDefault();
    setMessage("Manutenção validada em modo de pré-visualização. O registro está pronto para a futura API.");
  };

  return (
    <AppShell>
      <header className={styles.topBar}>
        <button aria-label="Voltar" className={styles.backButton} onClick={() => router.back()} type="button">
          <ArrowLeft aria-hidden size={24} weight="bold" />
        </button>
        <h1>Registrar manutenção</h1>
        <span />
      </header>

      <main className={styles.formScreen}>
        <div className={styles.heading}>
          <h2>Registro de Manutenção</h2>
          <p>Insira os dados do serviço realizado ou planejado.</p>
        </div>

        <form className={styles.maintenanceForm} noValidate onSubmit={submitMaintenance}>
          <fieldset className={styles.statusField}>
            <legend>Status do Serviço</legend>
            <div className={styles.statusToggle}>
              {['Realizada', 'A realizar'].map((status) => (
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
          </fieldset>

          <label className={styles.field}>
            <span>Categoria</span>
            <span className={styles.selectShell}>
              <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                <option value="">Selecione uma categoria</option>
                {maintenanceCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
          </label>

          <label className={styles.field}>
            <span>Quilometragem (km)</span>
            <span className={styles.inputShell}>
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                inputMode="numeric"
                name="mileage"
                onChange={(event) => updateField("mileage", event.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 45000"
                value={form.mileage}
              />
            </span>
          </label>

          <label className={styles.field}>
            <span>Data</span>
            <span className={styles.inputShell}>
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
          </label>

          <label className={styles.field}>
            <span>Descrição do Serviço</span>
            <textarea
              name="description"
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Detalhes das peças trocadas ou serviços executados..."
              rows={4}
              value={form.description}
            />
          </label>

          <label className={styles.field}>
            <span>Valor (R$)</span>
            <span className={styles.inputShell}>
              <input
                inputMode="decimal"
                name="value"
                onChange={(event) => updateField("value", event.target.value)}
                placeholder="R$ 0,00"
                value={form.value}
              />
            </span>
          </label>

          <label className={styles.field}>
            <span>Comprovante</span>
            <span className={styles.uploadBox}>
              <UploadSimple aria-hidden size={22} weight="bold" />
              <strong>{form.receiptName || "Anexar Nota Fiscal"}</strong>
              <input
                accept=".png,.jpg,.jpeg,.pdf"
                name="receipt"
                onChange={(event) => updateField("receiptName", event.target.files?.[0]?.name ?? "")}
                type="file"
              />
            </span>
            <small>Formatos suportados: JPG, PNG, PDF (Máx. 5MB)</small>
          </label>

          {message && <p className={styles.successMessage}>{message}</p>}

          <ActionButton type="submit">
            <FloppyDisk aria-hidden size={21} weight="bold" />
            Salvar Manutenção
          </ActionButton>
        </form>
      </main>
    </AppShell>
  );
}
