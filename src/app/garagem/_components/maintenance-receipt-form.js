"use client";

import { useState } from "react";
import { LockKey, UploadSimple } from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import { formatMileage } from "../../mock-data";
import FileUploadField from "./file-upload-field";
import styles from "./maintenance-receipt-form.module.css";

export default function MaintenanceReceiptForm({ maintenance }) {
  const [receiptName, setReceiptName] = useState(maintenance.attachment ?? "");

  const details = [
    ["Categoria", maintenance.category],
    ["Data da realização", maintenance.date],
    ["Quilometragem registrada", `${formatMileage(maintenance.mileage)} km`],
    ["Valor informado", maintenance.value ? `R$ ${maintenance.value}` : "Não informado"],
    ["Descrição", maintenance.description],
  ];

  const submitReceipt = (event) => {
    event.preventDefault();
  };

  return (
    <main className={`app-form-screen ${styles.formScreen}`}>
      <div className="app-form-heading">
        <h2>Comprovante da manutenção</h2>
        <p>Os dados concluídos são permanentes. Apenas o comprovante pode ser atualizado.</p>
      </div>

      <form className={`app-form-card ${styles.receiptForm}`} onSubmit={submitReceipt}>
        <div className={styles.lockNotice}>
          <LockKey aria-hidden size={20} weight="fill" />
          <span>Informações protegidas contra alteração</span>
        </div>

        <dl className={styles.details}>
          {details.map(([label, value]) => (
            <div className={styles.detailItem} key={label}>
              <dt>{label}</dt>
              <dd>{value || "Não informado"}</dd>
            </div>
          ))}
        </dl>

        <FileUploadField
          accept=".png,.jpg,.jpeg,.pdf"
          compact
          hint="Formatos suportados: JPG, PNG, PDF (Máx. 5MB)"
          label="Comprovante"
          name="receipt"
          onChange={setReceiptName}
          value={receiptName || "Anexar comprovante"}
        />

        <ActionButton type="submit">
          <UploadSimple aria-hidden size={21} weight="bold" />
          Salvar comprovante
        </ActionButton>
      </form>
    </main>
  );
}
