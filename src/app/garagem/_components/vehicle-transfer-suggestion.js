"use client";

import { ArrowsLeftRight, Info } from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import styles from "./vehicle-transfer-suggestion.module.css";

export default function VehicleTransferSuggestion({ disabled = false, onRequest, ownerHint = "" }) {
  return (
    <section className={styles.suggestion} role="alert">
      <span className={styles.icon}>
        <Info aria-hidden size={23} weight="fill" />
      </span>
      <div className={styles.content}>
        <strong>Veículo já cadastrado</strong>
        <p>
          {ownerHint
            ? <>Este veículo já possui histórico vinculado a <b>{ownerHint}</b></>
            : "Este veículo já possui histórico vinculado a outro usuário."}
        </p>
        <small>Você pode solicitar a transferência para trazer o veículo e seu histórico para sua garagem</small>
      </div>
      <ActionButton disabled={disabled} onClick={onRequest} type="button" variant="secondary">
        <ArrowsLeftRight aria-hidden size={20} weight="bold" />
        Solicitar transferência
      </ActionButton>
    </section>
  );
}
