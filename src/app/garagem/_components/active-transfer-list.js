"use client";

import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import ActionButton from "../../components/action-button";
import TransferCancelControl from "./transfer-cancel-control";
import styles from "./active-transfer-list.module.css";

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ConfirmationStatus({ confirmed, label }) {
  return (
    <span className={confirmed ? styles.confirmed : styles.waiting}>
      {confirmed
        ? <CheckCircle aria-hidden size={17} weight="fill" />
        : <ClockCountdown aria-hidden size={17} weight="duotone" />}
      {label}: {confirmed ? "confirmado" : "aguardando"}
    </span>
  );
}

export default function ActiveTransferList({
  cancellingId,
  error,
  hasMore,
  items,
  loading,
  loadingMore,
  onCancel,
  onLoadMore,
  onRetry,
  onSelect,
  total,
}) {
  return (
    <section aria-labelledby="active-transfers-title" className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 id="active-transfers-title">Transferências em andamento</h2>
          <p>Acompanhe as confirmações ou cancele uma solicitação pendente.</p>
        </div>
        {!loading && !error && total > 0 && <span>{total}</span>}
      </header>

      {loading ? (
        <div className={styles.requestState} role="status">
          <CircleNotch aria-hidden className={styles.loadingIcon} size={22} weight="bold" />
          Carregando transferências...
        </div>
      ) : error ? (
        <div className={styles.requestState} role="alert">
          <WarningCircle aria-hidden size={23} weight="duotone" />
          <strong>Não foi possível carregar as transferências</strong>
          <p>{error}</p>
          <button onClick={onRetry} type="button">Tentar novamente</button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <CheckCircle aria-hidden size={25} weight="duotone" />
          <div>
            <strong>Nenhuma transferência em andamento</strong>
            <p>Quando houver uma solicitação pendente, ela aparecerá aqui.</p>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((transfer) => {
            const isOwner = transfer.role === "owner";
            const counterpartLabel = isOwner ? "Novo proprietário" : "Proprietário atual";
            const continueHref = `/garagem/${transfer.vehicleId}/gerenciar/transferencia`;

            return (
              <article className={`app-card ${styles.card}`} key={transfer.id}>
                <div className={styles.cardHeading}>
                  <div>
                    <span className={styles.role}>{isOwner ? "Você está enviando" : "Você está recebendo"}</span>
                    <h3>{transfer.vehicle?.model || "Veículo"}</h3>
                    <p>{transfer.vehicle?.plate || "Placa não informada"}</p>
                  </div>
                  <span className={styles.status}>Em andamento</span>
                </div>

                {transfer.counterpart && (
                  <div className={styles.counterpart}>
                    <span>{counterpartLabel}</span>
                    <strong>{transfer.counterpart.name || transfer.counterpart.email}</strong>
                    {transfer.counterpart.name && transfer.counterpart.email && <small>{transfer.counterpart.email}</small>}
                  </div>
                )}

                <div className={styles.confirmations}>
                  <ConfirmationStatus confirmed={transfer.ownerValidated} label="Proprietário" />
                  <ConfirmationStatus confirmed={transfer.recipientValidated} label="Destinatário" />
                </div>

                <div className={styles.deadline}>
                  <CalendarBlank aria-hidden size={18} weight="duotone" />
                  <span>Prazo</span>
                  <strong>{formatDeadline(transfer.expiresAt)}</strong>
                </div>

                <div className={styles.actions}>
                  {isOwner ? (
                    <Link className={styles.continueLink} href={continueHref}>
                      Continuar
                      <ArrowRight aria-hidden size={18} weight="bold" />
                    </Link>
                  ) : (
                    <ActionButton
                      disabled={cancellingId === transfer.id}
                      onClick={() => onSelect(transfer)}
                      type="button"
                    >
                      Continuar
                      <ArrowRight aria-hidden size={18} weight="bold" />
                    </ActionButton>
                  )}
                  <TransferCancelControl
                    disabled={cancellingId === transfer.id}
                    onConfirm={() => onCancel(transfer)}
                  />
                </div>
              </article>
            );
          })}

          {hasMore && (
            <button className={styles.loadMore} disabled={loadingMore} onClick={onLoadMore} type="button">
              {loadingMore && <CircleNotch aria-hidden className={styles.loadingIcon} size={18} weight="bold" />}
              {loadingMore ? "Carregando..." : "Carregar mais transferências"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
