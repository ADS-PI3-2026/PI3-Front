"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EnvelopeSimple, X } from "@phosphor-icons/react";
import ActionButton from "../components/action-button";
import FormField from "../components/form-field";
import VerificationCodeFields from "../components/verification-code-fields";
import {
  createEmptyCode,
  getEmailChangeVerificationTargets,
  getNewEmailValidationError,
  REGISTRATION_TEXT_MAX_LENGTH,
} from "../lib/form-validation";
import styles from "./email-change-dialog.module.css";

export default function EmailChangeDialog({ user, onClose }) {
  const [step, setStep] = useState("email");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [currentCode, setCurrentCode] = useState(createEmptyCode);
  const [newCode, setNewCode] = useState(createEmptyCode);
  const dialogRef = useRef(null);
  const emailRef = useRef(null);
  const titleRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const targets = getEmailChangeVerificationTargets(user.document_type);
  const requiresCurrentCode = targets?.includes("current");

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === titleRef.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (step === "email") emailRef.current?.focus();
    else titleRef.current?.focus();
  }, [step]);

  const continueToCodes = (event) => {
    event.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    const validation = getNewEmailValidationError(normalized, user.email)
      || (!targets ? "Não foi possível identificar o tipo da conta. Recarregue seu perfil." : "");
    if (validation) {
      setError(validation);
      window.requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    setError("");
    setNewEmail(normalized);
    // Por enquanto só apresenta a próxima etapa: nenhum código é enviado ou validado.
    setStep("codes");
  };

  return (
    <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className={styles.dialog} ref={dialogRef} role="dialog">
        <button aria-label="Fechar alteração de e-mail" className={styles.closeButton} onClick={onClose} type="button">
          <X aria-hidden size={20} weight="bold" />
        </button>
        <span className={styles.icon}><EnvelopeSimple aria-hidden size={26} weight="duotone" /></span>
        <p className={styles.eyebrow}>Dados pessoais</p>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>{step === "email" ? "Alterar e-mail" : requiresCurrentCode ? "Confirme os dois e-mails" : "Confirme o novo e-mail"}</h2>
        <p className={styles.description} id={descriptionId}>
          {requiresCurrentCode
            ? "Você precisará confirmar um código no e-mail atual e outro no novo."
            : "Você precisará confirmar um código apenas no novo e-mail."}
        </p>

        {step === "email" ? (
          <form className={styles.form} noValidate onSubmit={continueToCodes}>
            <p className={styles.currentEmail}>E-mail atual: <strong>{user.email}</strong></p>
            <FormField
              autoComplete="email"
              error={error}
              icon="envelope"
              label="Novo e-mail"
              maxLength={REGISTRATION_TEXT_MAX_LENGTH}
              name="new-email"
              onChange={(event) => { setNewEmail(event.target.value); setError(""); }}
              placeholder="seu.novo@email.com"
              ref={emailRef}
              required
              type="email"
              value={newEmail}
            />
            <ActionButton type="submit">Continuar</ActionButton>
          </form>
        ) : (
          <div className={styles.form}>
            {requiresCurrentCode && (
              <div className={styles.codeGroup}>
                <p>{user.email}</p>
                <VerificationCodeFields autoFocus={false} code={currentCode} disabled label="Código do e-mail atual" onChange={setCurrentCode} />
              </div>
            )}
            <div className={styles.codeGroup}>
              <p>{newEmail}</p>
              <VerificationCodeFields autoFocus={false} code={newCode} disabled label="Código do novo e-mail" onChange={setNewCode} />
            </div>
            <ActionButton disabled type="button">Confirmar alteração</ActionButton>
            <ActionButton onClick={() => setStep("email")} type="button" variant="secondary">Alterar endereço informado</ActionButton>
          </div>
        )}
      </section>
    </div>
  );
}
