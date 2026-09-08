"use client";

import { UploadSimple } from "@phosphor-icons/react";
import styles from "./file-upload-field.module.css";

export default function FileUploadField({ accept, compact = false, error, hint, label, name, onChange, value }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.uploadBox} data-compact={compact} data-error={Boolean(error)}>
        <UploadSimple aria-hidden size={26} weight="bold" />
        <strong>{value || "Anexar arquivo"}</strong>
        <input
          accept={accept}
          name={name}
          onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")}
          type="file"
        />
      </span>
      {hint && <small className={styles.hintText}>{hint}</small>}
      {error && <small className={styles.errorText}>{error}</small>}
    </label>
  );
}
