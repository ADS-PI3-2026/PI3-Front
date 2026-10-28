"use client";

import { useId } from "react";
import {
  File,
  FileImage,
  FilePdf,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import styles from "./file-upload-field.module.css";

function formatFileSize(size) {
  if (!Number.isFinite(size)) return "Tamanho desconhecido";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "PDF";
  if (file.type === "image/png" || /\.png$/i.test(file.name)) return "PNG";
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) return "JPG";
  return file.type || "Formato desconhecido";
}

function FileTypeIcon({ file }) {
  const type = getFileType(file);
  if (type === "PDF") return <FilePdf aria-hidden size={21} weight="duotone" />;
  if (["PNG", "JPG"].includes(type)) {
    return <FileImage aria-hidden size={21} weight="duotone" />;
  }
  return <File aria-hidden size={21} weight="duotone" />;
}

function getFileKey(file) {
  return [file.name, file.size, file.lastModified, file.type].join("-");
}

function getSelectionLabel(files) {
  if (files.length > 1) return `${files.length} arquivos selecionados`;
  return files[0]?.name ?? "";
}

export default function FileUploadField({
  accept,
  compact = false,
  disabled = false,
  error,
  hint,
  label,
  maxFiles,
  maxFileSize,
  multiple = false,
  name,
  onChange,
  selectedFiles = [],
  value,
}) {
  const inputId = useId();

  const updateFiles = (files) => {
    onChange(getSelectionLabel(files), files);
  };

  const addFiles = (newFiles) => {
    const filesByKey = new Map(selectedFiles.map((file) => [getFileKey(file), file]));
    for (const file of newFiles) filesByKey.set(getFileKey(file), file);
    updateFiles(Array.from(filesByKey.values()));
  };

  const removeFile = (index) => {
    updateFiles(selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  return (
    <div className="app-field app-field--uppercase">
      <span id={`${inputId}-label`}>{label}</span>
      <label
        aria-labelledby={`${inputId}-label`}
        className={styles.uploadBox}
        data-compact={compact}
        data-disabled={disabled}
        data-error={Boolean(error)}
        htmlFor={inputId}
      >
        <UploadSimple aria-hidden size={26} weight="bold" />
        <strong>
          {selectedFiles.length > 0 ? "Adicionar outros arquivos" : value || "Anexar arquivo"}
        </strong>
        <input
          accept={accept}
          disabled={disabled}
          id={inputId}
          multiple={multiple}
          name={name}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            addFiles(files);
            event.target.value = "";
          }}
          type="file"
        />
      </label>

      {selectedFiles.length > 0 && (
        <section className={styles.pendingFiles} aria-label="Arquivos aguardando envio">
          <div className={styles.pendingHeading} aria-live="polite">
            <strong>Prontos para enviar</strong>
            <span data-error={Number.isInteger(maxFiles) && selectedFiles.length > maxFiles}>
              {selectedFiles.length}{Number.isInteger(maxFiles) ? `/${maxFiles}` : ""}
            </span>
          </div>

          <ul className={styles.pendingList}>
            {selectedFiles.map((file, index) => {
              const tooLarge = Number.isFinite(maxFileSize) && file.size > maxFileSize;
              return (
                <li className={styles.pendingItem} data-error={tooLarge} key={`${getFileKey(file)}-${index}`}>
                  <span className={styles.fileIcon}>
                    <FileTypeIcon file={file} />
                  </span>
                  <span className={styles.fileDetails}>
                    <strong title={file.name}>{file.name}</strong>
                    <small>
                      {getFileType(file)} · {formatFileSize(file.size)}
                      {tooLarge ? ` · Acima de ${formatFileSize(maxFileSize)}` : ""}
                    </small>
                  </span>
                  <button
                    aria-label={`Remover ${file.name} da seleção`}
                    className={styles.removeButton}
                    disabled={disabled}
                    onClick={() => removeFile(index)}
                    title="Remover da seleção"
                    type="button"
                  >
                    <X aria-hidden size={18} weight="bold" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hint && <small className={styles.hintText}>{hint}</small>}
      {error && <small className="app-error-text">{error}</small>}
    </div>
  );
}
