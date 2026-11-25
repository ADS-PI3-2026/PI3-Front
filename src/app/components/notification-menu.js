"use client";

import {
  ArrowsLeftRightIcon,
  BellRingingIcon,
  CalendarBlankIcon,
  CarIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CloudArrowUpIcon,
  PencilSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import styles from "./notification-menu.module.css";

const notificationIcons = {
  draft: PencilSimpleIcon,
  overdue: WarningCircleIcon,
  sync: CloudArrowUpIcon,
  transfer: ArrowsLeftRightIcon,
  upcoming: CalendarBlankIcon,
  vehicleDraft: CarIcon,
};

export default function NotificationMenu({
  count,
  loading = false,
  notifications = [],
  onOpenChange,
  open,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  const visibleCount = count > 9 ? "9+" : count;

  return (
    <div className={styles.root}>
      <button
        aria-controls="garage-notification-menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={loading
          ? "Carregando avisos"
          : count > 0
            ? `${count} ${count === 1 ? "aviso ativo" : "avisos ativos"}`
            : "Nenhuma atividade pendente"}
        className={styles.trigger}
        data-active={!loading && count > 0}
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <BellRingingIcon aria-hidden size={21} weight={open ? "fill" : "duotone"} />
        {loading ? (
          <span aria-hidden className={`${styles.badge} ${styles.badgeLoading}`}>
            <CircleNotchIcon size={12} weight="bold" />
          </span>
        ) : count > 0 ? (
          <span aria-hidden className={styles.badge}>{visibleCount}</span>
        ) : null}
      </button>

      {open && (
        <>
          <button
            aria-label="Fechar notificações"
            className={styles.backdrop}
            onClick={() => onOpenChange(false)}
            type="button"
          />
          <div
            aria-label="Notificações ativas"
            className={styles.menu}
            id="garage-notification-menu"
            role="dialog"
          >
            <header>
              <strong>Avisos</strong>
              <span>
                {loading
                  ? "Atualizando suas atividades importantes"
                  : notifications.length > 0
                  ? "Pendências e atividades que precisam da sua atenção"
                  : "Acompanhe suas atividades importantes por aqui"}
              </span>
            </header>

            {notifications.length > 0 ? (
              <div className={styles.list}>
                {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] ?? BellRingingIcon;
                return (
                  <Link
                    className={styles.item}
                    data-tone={notification.tone}
                    href={notification.href}
                    key={notification.id}
                    onClick={() => onOpenChange(false)}
                  >
                    <span className={styles.itemIcon}>
                      <Icon aria-hidden size={21} weight="duotone" />
                    </span>
                    <span className={styles.itemCopy}>
                      <strong>{notification.title}</strong>
                      <small>{notification.description}</small>
                    </span>
                    <CaretRightIcon aria-hidden size={18} weight="bold" />
                  </Link>
                );
                })}
              </div>
            ) : loading ? (
              <div className={styles.loadingState} role="status">
                <CircleNotchIcon aria-hidden size={24} weight="bold" />
                <span>Verificando atividades...</span>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span>
                  <CheckCircleIcon aria-hidden size={25} weight="duotone" />
                </span>
                <strong>Tudo em dia</strong>
                <small>Nenhuma atividade pendente no momento.</small>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
