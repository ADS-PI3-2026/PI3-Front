"use client";

import { useState } from "react";
import {
  CircleNotch,
  DownloadSimple,
  File,
  FileImage,
  FilePdf,
  LockKey,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import { getAuthErrorMessage } from "../../auth-api";
import {
  deleteMaintenanceAttachment,
  downloadMaintenanceAttachment,
  uploadMaintenanceAttachments,
} from "../_lib/garage-api";
import FileUploadField from "./file-upload-field";
import styles from "./maintenance-receipt-form.module.css";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const acceptedFileTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatPayloadValue(value) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "Não informado";
  if (value == null || value === "") return "Não informado";
  return String(value);
}

function formatPayloadLabel(name, fields) {
  const field = fields.find((item) => item.name === name);
  if (field?.label) return field.label;

  const label = String(name).replace(/[-_]+/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Informação adicional";
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return "Tamanho não informado";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file) {
  if (acceptedFileTypes.has(file.type)) return true;
  return /\.(jpe?g|png|pdf)$/i.test(file.name);
}

function AttachmentIcon({ mimeType }) {
  if (mimeType === "application/pdf") return <FilePdf aria-hidden size={23} weight="duotone" />;
  if (mimeType.startsWith("image/")) return <FileImage aria-hidden size={23} weight="duotone" />;
  return <File aria-hidden size={23} weight="duotone" />;
}

export default function MaintenanceReceiptForm({ maintenance, onRefresh, serviceFields = [] }) {
  const [files, setFiles] = useState([]);
  const [fileLabel, setFileLabel] = useState("");
  const [fileError, setFileError] = useState("");
  const [feedback, setFeedback] = useState({ message: "", type: "" });
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [uploadRevision, setUploadRevision] = useState(0);

  const details = [
    ["Categoria", maintenance.category],
    ["Data da realização", maintenance.date],
    ["Quilometragem registrada", `${mileageFormatter.format(maintenance.mileage)} km`],
    ["Valor informado", currencyFormatter.format(maintenance.cost)],
    ["Registrado por", maintenance.registeredBy],
    ["Descrição", maintenance.description],
  ];
  const payloadEntries = Object.entries(maintenance.payload);

  const selectFiles = (label, selectedFiles) => {
    setFeedback({ message: "", type: "" });
    setFileError("");
    setFileLabel(label);
    setFiles(selectedFiles);

    if (selectedFiles.length > MAX_FILES) {
      setFileError("Selecione no máximo cinco arquivos por envio.");
    } else if (selectedFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      setFileError("Cada arquivo deve ter no máximo 10 MB.");
    } else if (selectedFiles.some((file) => !isAcceptedFile(file))) {
      setFileError("Envie somente arquivos JPG, PNG ou PDF.");
    }
  };

  const submitReceipt = async (event) => {
    event.preventDefault();
    if (files.length === 0) {
      setFileError("Selecione ao menos um comprovante.");
      return;
    }
    if (
      files.length > MAX_FILES
      || files.some((file) => file.size > MAX_FILE_SIZE)
      || files.some((file) => !isAcceptedFile(file))
    ) return;

    setUploading(true);
    setFeedback({ message: "", type: "" });
    try {
      await uploadMaintenanceAttachments(maintenance.id, files);
      setFiles([]);
      setFileLabel("");
      setUploadRevision((revision) => revision + 1);
      try {
        await onRefresh();
        setFeedback({ message: "Comprovante enviado com sucesso.", type: "success" });
      } catch {
        setFeedback({
          message: "O comprovante foi enviado, mas a lista não pôde ser atualizada. Reabra a página para conferi-lo.",
          type: "error",
        });
      }
    } catch (error) {
      setFeedback({
        message: getAuthErrorMessage(error, "Não foi possível enviar o comprovante. Tente novamente."),
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    setActionId(attachment.id);
    setFeedback({ message: "", type: "" });
    try {
      const blob = await downloadMaintenanceAttachment(attachment.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setFeedback({
        message: getAuthErrorMessage(error, "Não foi possível baixar o comprovante. Tente novamente."),
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  const deleteAttachment = async (attachment) => {
    setActionId(attachment.id);
    setFeedback({ message: "", type: "" });
    try {
      await deleteMaintenanceAttachment(attachment.id);
      setConfirmDeleteId(null);
      try {
        await onRefresh();
        setFeedback({ message: "Comprovante removido com sucesso.", type: "success" });
      } catch {
        setFeedback({
          message: "O comprovante foi removido, mas a lista não pôde ser atualizada. Reabra a página para conferir.",
          type: "error",
        });
      }
    } catch (error) {
      setFeedback({
        message: getAuthErrorMessage(error, "Não foi possível remover o comprovante. Tente novamente."),
        type: "error",
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <main className={`app-form-screen ${styles.formScreen}`}>
      <div className="app-form-heading">
        <h2>Detalhes da manutenção</h2>
        <p>Consulte os dados registrados e os comprovantes deste serviço.</p>
      </div>

      <section className={`app-form-card ${styles.receiptForm}`}>
        <div className={styles.lockNotice}>
          <LockKey aria-hidden size={20} weight="fill" />
          <span>
            {maintenance.readonly
              ? "Registro de proprietário anterior disponível somente para consulta"
              : "Informações concluídas protegidas contra alteração"}
          </span>
        </div>

        <dl className={styles.details}>
          {details.map(([label, value]) => (
            <div className={styles.detailItem} key={label}>
              <dt>{label}</dt>
              <dd>{value || "Não informado"}</dd>
            </div>
          ))}
        </dl>

        {payloadEntries.length > 0 && (
          <section className={styles.additionalDetails}>
            <h3>Informações do serviço</h3>
            <dl className={styles.details}>
              {payloadEntries.map(([name, value]) => (
                <div className={styles.detailItem} key={name}>
                  <dt>{formatPayloadLabel(name, serviceFields)}</dt>
                  <dd>{formatPayloadValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className={styles.attachmentsSection}>
          <div className={styles.sectionHeading}>
            <h3>Comprovantes</h3>
            <span>{maintenance.attachments.length}</span>
          </div>

          {maintenance.attachments.length === 0 ? (
            <p className={styles.emptyAttachments}>Nenhum comprovante anexado.</p>
          ) : (
            <ul className={styles.attachmentList}>
              {maintenance.attachments.map((attachment) => {
                const busy = actionId === attachment.id;
                const confirming = confirmDeleteId === attachment.id;

                return (
                  <li className={styles.attachmentItem} key={attachment.id}>
                    <span className={styles.fileIcon}>
                      <AttachmentIcon mimeType={attachment.mimeType} />
                    </span>
                    <span className={styles.fileInfo}>
                      <strong>{attachment.name}</strong>
                      <small>{formatFileSize(attachment.size)}</small>
                    </span>

                    {attachment.canDownload && (
                      <div className={styles.fileActions}>
                        {confirming ? (
                          <>
                            <button
                              className={styles.cancelDeleteButton}
                              disabled={busy}
                              onClick={() => setConfirmDeleteId(null)}
                              type="button"
                            >
                              Cancelar
                            </button>
                            <button
                              className={styles.confirmDeleteButton}
                              disabled={busy}
                              onClick={() => void deleteAttachment(attachment)}
                              type="button"
                            >
                              {busy ? <CircleNotch aria-hidden className={styles.loadingIcon} size={17} /> : null}
                              Remover
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label={`Baixar ${attachment.name}`}
                              className={styles.fileActionButton}
                              disabled={busy}
                              onClick={() => void downloadAttachment(attachment)}
                              title="Baixar comprovante"
                              type="button"
                            >
                              {busy
                                ? <CircleNotch aria-hidden className={styles.loadingIcon} size={19} />
                                : <DownloadSimple aria-hidden size={19} weight="bold" />}
                            </button>
                            <button
                              aria-label={`Remover ${attachment.name}`}
                              className={`${styles.fileActionButton} ${styles.deleteButton}`}
                              disabled={busy}
                              onClick={() => setConfirmDeleteId(attachment.id)}
                              title="Remover comprovante"
                              type="button"
                            >
                              <Trash aria-hidden size={19} weight="bold" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!maintenance.readonly && (
          <form className={styles.uploadForm} onSubmit={submitReceipt}>
            <FileUploadField
              accept=".png,.jpg,.jpeg,.pdf"
              compact
              disabled={uploading}
              error={fileError}
              hint="JPG, PNG ou PDF. Até 5 arquivos de 10 MB por envio."
              key={uploadRevision}
              label="Adicionar comprovantes"
              maxFiles={MAX_FILES}
              maxFileSize={MAX_FILE_SIZE}
              multiple
              name="receipt"
              onChange={selectFiles}
              selectedFiles={files}
              value={fileLabel || "Selecionar arquivos"}
            />

            <ActionButton disabled={uploading || Boolean(fileError)} type="submit">
              {uploading
                ? <CircleNotch aria-hidden className={styles.loadingIcon} size={21} />
                : <UploadSimple aria-hidden size={21} weight="bold" />}
              {uploading ? "Enviando..." : "Enviar comprovantes"}
            </ActionButton>
          </form>
        )}

        {feedback.message && (
          <p
            className={`app-feedback app-feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </section>
    </main>
  );
}
