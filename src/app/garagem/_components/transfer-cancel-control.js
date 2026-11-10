"use client";

import { WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import ActionButton from "../../components/action-button";
import styles from "./transfer-cancel-control.module.css";

export default function TransferCancelControl({ disabled = false, onConfirm }) {
  const titleId = useId();
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const confirmCancellation = async () => {
    const cancelled = await onConfirm();
    if (cancelled !== false) setConfirmationOpen(false);
  };

  if (!confirmationOpen) {
    return (
      <ActionButton
        disabled={disabled}
        onClick={() => setConfirmationOpen(true)}
        type="button"
        variant="secondary"
      >
        <XCircleIcon aria-hidden size={19} weight="bold" />
        Cancelar transferência
      </ActionButton>
    );
  }

  return (
    <div className={styles.confirmation} role="alertdialog" aria-labelledby={titleId}>
      <WarningCircleIcon aria-hidden size={24} weight="fill" />
      <div>
        <strong id={titleId}>Cancelar esta transferência?</strong>
        <p>O veículo continuará com o proprietário atual</p>
      </div>
      <div className={styles.actions}>
        <ActionButton disabled={disabled} onClick={() => void confirmCancellation()} type="button" variant="danger">
          {disabled ? "Cancelando..." : "Confirmar cancelamento"}
        </ActionButton>
        <ActionButton disabled={disabled} onClick={() => setConfirmationOpen(false)} type="button" variant="secondary">
          Manter transferência
        </ActionButton>
      </div>
    </div>
  );
}
