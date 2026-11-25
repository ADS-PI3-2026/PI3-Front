"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import styles from "./toast-provider.module.css";

const ToastContext = createContext(null);
const durations = {
  error: 15000,
  info: 8000,
  success: 8000,
  warning: 8000,
};
const icons = {
  error: XCircleIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
};

function Toast({ toast, onClose }) {
  const Icon = icons[toast.tone] ?? InfoIcon;
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef(null);

  const closeWithAnimation = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    exitTimer.current = window.setTimeout(onClose, 280);
  }, [exiting, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(closeWithAnimation, toast.duration);
    return () => window.clearTimeout(timer);
  }, [closeWithAnimation, toast.duration]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  return (
    <aside
      aria-atomic="true"
      className={styles.toast}
      data-exiting={exiting}
      data-tone={toast.tone}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden className={styles.icon} size={22} weight="fill" />
      <p>{toast.message}</p>
      <button aria-label="Fechar notificação" onClick={closeWithAnimation} type="button">
        <XIcon aria-hidden size={18} weight="bold" />
      </button>
      <span
        aria-hidden
        className={styles.progress}
        key={toast.id}
        style={{ "--toast-duration": `${toast.duration}ms` }}
      />
    </aside>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("As notificações precisam estar dentro de ToastProvider.");
  return context;
}

export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback(({ duration, message, tone = "info" }) => {
    const normalizedMessage = String(message ?? "").trim();
    if (!normalizedMessage) return;
    const normalizedTone = Object.hasOwn(durations, tone) ? tone : "info";
    setToast({
      duration: Number.isFinite(duration) && duration > 0
        ? duration
        : durations[normalizedTone],
      id: `${Date.now()}-${Math.random()}`,
      message: normalizedMessage,
      tone: normalizedTone,
    });
  }, []);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          onClose={dismissToast}
          toast={toast}
        />
      )}
    </ToastContext.Provider>
  );
}
