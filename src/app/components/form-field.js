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
  emphasized = false,
  actionLabel,
  ActionIcon,
  onAction,
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
    <label className={`app-field ${styles.field}`}>
      <span className="app-field-label">{label}</span>
      <span className={`${styles.inputShell} ${emphasized ? styles.emphasized : ""} ${error ? styles.inputError : ""}`}>
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
        {onAction && ActionIcon && (
          <button
            aria-label={actionLabel}
            className={styles.actionButton}
            onClick={(event) => { event.preventDefault(); onAction(); }}
            title={actionLabel}
            type="button"
          >
            <ActionIcon aria-hidden size={21} weight="bold" />
          </button>
        )}
        {onToggle && (
          <button
            aria-label={toggleLabel}
            aria-pressed={type === "text"}
            className={styles.visibilityButton}
            onClick={onToggle}
            type="button"
          >
            <VisibilityIcon aria-hidden size={20} weight="regular" />
          </button>
        )}
      </span>
      {error && <span className="app-error-text" id={errorId}>{error}</span>}
    </label>
  );
}
