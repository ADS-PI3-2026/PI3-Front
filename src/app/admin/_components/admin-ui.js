"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowClockwiseIcon,
  XIcon,
} from "@phosphor-icons/react";
import { getAdminErrorMessage } from "../admin-api";
import styles from "../admin.module.css";

export function useAdminResource(loader, { enabled = true, refreshKey = 0 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      setState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const data = await loader();
        if (active) setState({ data, loading: false, error: null });
      } catch (error) {
        if (active)
          setState((previous) => ({ ...previous, loading: false, error }));
      }
    });
    return () => {
      active = false;
    };
  }, [enabled, loader, revision, refreshKey]);
  return { ...state, reload };
}

export function PageHeading({ title, description, children, as: Heading = "h1" }) {
  return (
    <header className={styles.pageHeading}>
      <div>
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function Feedback({ message, error = false }) {
  if (!message) return null;
  return (
    <p
      className={`app-feedback ${error ? "app-feedback--error" : "app-feedback--success"}`}
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

export function ResourceState({
  loading,
  error,
  retry,
  children,
  data,
  keepContent = false,
}) {
  if (keepContent && data != null) {
    return (
      <>
        {error && (
          <div className={styles.refreshError}>
            <Feedback error message={getAdminErrorMessage(error)} />
            <button
              className={styles.secondaryButton}
              disabled={loading}
              onClick={retry}
              type="button"
            >
              <ArrowClockwiseIcon aria-hidden size={18} />
              Tentar novamente
            </button>
          </div>
        )}
        {children}
      </>
    );
  }
  if (loading)
    return (
      <div className={styles.empty} role="status">
        <span className={styles.spinner} />
        Carregando dados…
      </div>
    );
  if (error)
    return (
      <div className={styles.empty}>
        <p role="alert">{getAdminErrorMessage(error)}</p>
        <button
          className={styles.secondaryButton}
          onClick={retry}
          type="button"
        >
          <ArrowClockwiseIcon aria-hidden size={18} />
          Tentar novamente
        </button>
      </div>
    );
  return children;
}

export function Pagination({ data, onPage, disabled = false }) {
  if (!data || data.lastPage < 2) return null;
  return (
    <nav aria-label="Paginação" className={styles.pagination}>
      <span>
        Página {data.page} de {data.lastPage} · {data.total} registros
      </span>
      <div>
        <button
          aria-label="Página anterior"
          className={styles.secondaryButton}
          disabled={disabled || data.page <= 1}
          onClick={() => onPage(data.page - 1)}
          type="button"
        >
          <ArrowLeftIcon aria-hidden size={18} />
          Anterior
        </button>
        <button
          aria-label="Próxima página"
          className={styles.secondaryButton}
          disabled={disabled || data.page >= data.lastPage}
          onClick={() => onPage(data.page + 1)}
          type="button"
        >
          Próxima
          <ArrowRightIcon aria-hidden size={18} />
        </button>
      </div>
    </nav>
  );
}

export function Field({
  label,
  error,
  hint,
  as: Control = "input",
  children,
  ...props
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <Control
        aria-describedby={error || hint ? `${id}-help` : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        {...props}
      >
        {children}
      </Control>
      {(error || hint) && (
        <small
          className={error ? styles.fieldError : styles.hint}
          id={`${id}-help`}
        >
          {error || hint}
        </small>
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      className={`${styles.modal} ${wide ? styles.wideModal : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      ref={ref}
    >
      <header className={styles.modalHeading}>
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label="Fechar diálogo"
          className={styles.iconButton}
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          <XIcon aria-hidden size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
  error,
}) {
  return (
    <Modal busy={busy} onClose={onClose} title={title}>
      <p className={styles.description}>{description}</p>
      <Feedback error message={error} />
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          Voltar
        </button>
        <button
          className={styles.dangerButton}
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? "Excluindo…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Status({ active }) {
  return (
    <span className={active ? styles.activeStatus : styles.inactiveStatus}>
      <span aria-hidden />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function formatAdminDate(value) {
  if (!value) return "—";
  const [date] = value.split(/[T ]/);
  const parts = date.split("-");
  return parts.length === 3 ? parts.reverse().join("/") : "—";
}
