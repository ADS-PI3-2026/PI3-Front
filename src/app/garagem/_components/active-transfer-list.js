"use client";

import {
  ArrowsLeftRightIcon,
  CaretRightIcon,
  CircleNotchIcon,
  ClockCountdownIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import styles from "./active-transfer-list.module.css";

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getProgress(transfer) {
  const isOwner = transfer.role === "owner";
  const userConfirmed = isOwner ? transfer.ownerValidated : transfer.recipientValidated;
  const counterpartConfirmed = isOwner ? transfer.recipientValidated : transfer.ownerValidated;

  if (!userConfirmed) return { label: "Sua confirmação está pendente", tone: "action" };
  if (!counterpartConfirmed) return { label: "Aguardando a outra pessoa", tone: "waiting" };
  return { label: "Confirmações recebidas", tone: "confirmed" };
}

function TransferRowContent({ transfer }) {
  const isOwner = transfer.role === "owner";
  const progress = getProgress(transfer);
  const counterpart = transfer.counterpart?.name || transfer.counterpart?.email;

  return (
    <>
      <span className={styles.icon}>
        <ArrowsLeftRightIcon aria-hidden size={23} weight="duotone" />
      </span>

      <span className={styles.copy}>
        <span className={styles.role}>{isOwner ? "Você está enviando" : "Você está recebendo"}</span>
        <strong>{transfer.vehicle?.model || "Veículo"}</strong>
        <small>
          {transfer.vehicle?.plate || "Placa não informada"}
          {counterpart ? ` · ${counterpart}` : ""}
        </small>
      </span>

      <span className={styles.summary}>
        <span className={`${styles.progress} ${styles[progress.tone]}`}>{progress.label}</span>
        <small>
          <ClockCountdownIcon aria-hidden size={15} weight="duotone" />
          Até {formatDeadline(transfer.expiresAt)}
        </small>
      </span>

      <CaretRightIcon aria-hidden className={styles.caret} size={19} weight="bold" />
    </>
  );
}

export default function ActiveTransferList({
  error,
  hasMore,
  items,
  loading,
  loadingMore,
  onLoadMore,
  onRetry,
  onSelect,
  total,
}) {
  return (
    <section aria-labelledby="active-transfers-title" className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 id="active-transfers-title">Em andamento</h2>
          <p>Abra uma transferência para ver os detalhes e continuar</p>
        </div>
        {!loading && !error && total > 0 && <span>{total}</span>}
      </header>

      {loading ? (
        <div className={styles.requestState} role="status">
          <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={22} weight="bold" />
          Carregando transferências...
        </div>
      ) : error ? (
        <div className={styles.requestState} role="alert">
          <WarningCircleIcon aria-hidden size={23} weight="duotone" />
          <strong>Não foi possível carregar as transferências</strong>
          <p>{error}</p>
          <button onClick={onRetry} type="button">Tentar novamente</button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>Nenhuma transferência em andamento</strong>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((transfer) => {
              const isOwner = transfer.role === "owner";
              const continueHref = `/garagem/${transfer.vehicleId}/gerenciar/transferencia`;

              return (
                <li key={transfer.id}>
                  {isOwner ? (
                    <Link className={styles.row} href={continueHref}>
                      <TransferRowContent transfer={transfer} />
                    </Link>
                  ) : (
                    <button className={styles.row} onClick={() => onSelect(transfer)} type="button">
                      <TransferRowContent transfer={transfer} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button className={styles.loadMore} disabled={loadingMore} onClick={onLoadMore} type="button">
              {loadingMore && <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={18} weight="bold" />}
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
