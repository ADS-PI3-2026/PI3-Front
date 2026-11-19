"use client";

import { useEffect, useId, useRef } from "react";
import { ShieldCheckIcon, XIcon } from "@phosphor-icons/react";
import { legalContent } from "../lib/legal-content";
import ActionButton from "./action-button";
import LegalDocument from "./legal-document";
import styles from "./legal-dialog.module.css";

export default function LegalDialog({ type, onClose }) {
  const content = legalContent[type];
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    };
  }, []);

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      ref={dialogRef}
    >
      <button aria-label="Fechar" className={styles.closeButton} onClick={onClose} type="button">
        <XIcon aria-hidden size={20} />
      </button>
      <header className={styles.header}>
        <span className={styles.icon}><ShieldCheckIcon aria-hidden size={24} /></span>
        <div>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2 id={titleId}>{content.title}</h2>
        </div>
      </header>
      <div className={styles.copy}>
        <LegalDocument key={type} type={type} />
      </div>
      <ActionButton className={styles.acknowledge} onClick={onClose} type="button">Entendi</ActionButton>
    </dialog>
  );
}
