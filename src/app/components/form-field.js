"use client";

import { useId } from "react";
import {
  EnvelopeSimple,
  Eye,
  EyeSlash,
  IdentificationCard,
  LockKey,
  UserCircle,
} from "@phosphor-icons/react";
import styles from "./form-field.module.css";

const ICONS = {
  envelope: EnvelopeSimple,
  idCard: IdentificationCard,
  lock: LockKey,
  user: UserCircle,
};

export default function FormField({
  error,
  icon,
  Icon,
  label,
  onToggle,
  toggleLabel,
  type = "text",
  ...inputProps
}) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;
  const LeadingIcon = Icon ?? ICONS[icon];
  const VisibilityIcon = type === "password" ? Eye : EyeSlash;

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.inputShell} ${error ? styles.inputError : ""}`}>
        {LeadingIcon && (
          <span className={styles.inputIcon}>
            <LeadingIcon aria-hidden size={20} weight="regular" />
          </span>
        )}
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          type={type}
          {...inputProps}
        />
        {onToggle && (
          <button
            aria-label={toggleLabel}
            className={styles.visibilityButton}
            onClick={onToggle}
            type="button"
          >
            <VisibilityIcon aria-hidden size={20} weight="regular" />
          </button>
        )}
      </span>
      {error && <span className={styles.fieldError} id={errorId}>{error}</span>}
    </label>
  );
}
