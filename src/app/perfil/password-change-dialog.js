"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircleIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  XIcon,
} from "@phosphor-icons/react";
import ActionButton from "../components/action-button";
import FormField from "../components/form-field";
import VerificationCodeFields from "../components/verification-code-fields";
import { getAuthErrorMessage, getAuthFieldErrors, submitAuthRequest } from "../auth-api";
import {
  CODE_RESEND_WAIT_SECONDS,
  createEmptyCode,
  getPasswordValidationError,
} from "../lib/form-validation";
import { getRecoveryStep } from "../lib/recovery-flow";
import styles from "./password-change-dialog.module.css";

function getInitialStep(email, request) {
  const recoveryStep = getRecoveryStep({ email, ...request }, Date.now());
  return recoveryStep === "email" ? "request" : recoveryStep;
}

export default function PasswordChangeDialog({ email, onClose, onRequestChange, request }) {
  const [step, setStep] = useState(() => getInitialStep(email, request));
  const [code, setCode] = useState(createEmptyCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sentAt, setSentAt] = useState(request.sentAt || 0);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(
    0,
    CODE_RESEND_WAIT_SECONDS - Math.floor((Date.now() - (request.sentAt || 0)) / 1000),
  ));
  const dialogRef = useRef(null);
  const pendingRef = useRef(false);
  const titleRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !pendingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      )];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === titleRef.current)) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    titleRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (step !== "code" || !sentAt) return undefined;
    const updateTimeLeft = () => {
      setTimeLeft(Math.max(
        0,
        CODE_RESEND_WAIT_SECONDS - Math.floor((Date.now() - sentAt) / 1000),
      ));
    };
    updateTimeLeft();
    const timer = window.setInterval(updateTimeLeft, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt, step]);

  const showRequestError = (error, fallback) => {
    const fieldErrors = getAuthFieldErrors(error);
    setErrors({ ...fieldErrors, confirmPassword: fieldErrors.confirm });
    setMessage(getAuthErrorMessage(error, fallback));
  };

  const requestCode = async () => {
    if (pending || (sentAt && Date.now() - sentAt < CODE_RESEND_WAIT_SECONDS * 1000)) {
      setStep("code");
      return;
    }

    setPending(true);
    setErrors({});
    setMessage("");
    try {
      await submitAuthRequest("requestPasswordReset", { email });
      const requestedAt = Date.now();
      setSentAt(requestedAt);
      setTimeLeft(CODE_RESEND_WAIT_SECONDS);
      setCode(createEmptyCode());
      onRequestChange({ sentAt: requestedAt, verifiedAt: 0 });
      setStep("code");
    } catch (error) {
      showRequestError(error, "Não foi possível enviar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (pending) return;
    const value = code.join("");
    if (!/^\d{6}$/.test(value)) {
      setMessage("Digite os seis números enviados para o seu e-mail.");
      return;
    }

    setPending(true);
    setErrors({});
    setMessage("");
    try {
      await submitAuthRequest("verifyPasswordCode", { code: value, email });
      const verifiedAt = Date.now();
      onRequestChange({ sentAt, verifiedAt });
      setCode(createEmptyCode());
      setStep("password");
    } catch (error) {
      showRequestError(error, "O código não pôde ser validado. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (pending) return;
    const nextErrors = {};
    const passwordError = getPasswordValidationError(password);
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmPassword) nextErrors.confirmPassword = "Repita a nova senha.";
    else if (password !== confirmPassword) nextErrors.confirmPassword = "As senhas não coincidem.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    setErrors({});
    setMessage("");
    try {
      await submitAuthRequest("resetPassword", {
        email,
        password,
        password_confirmation: confirmPassword,
      });
      setPassword("");
      setConfirmPassword("");
      onRequestChange({ sentAt: 0, verifiedAt: 0 });
      setStep("success");
    } catch (error) {
      showRequestError(error, "Não foi possível alterar a senha. Tente novamente.");
      if (error.status === 403) {
        onRequestChange({ sentAt, verifiedAt: 0 });
        setCode(createEmptyCode());
        setStep("code");
      }
    } finally {
      setPending(false);
    }
  };

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  const titles = {
    request: "Alterar senha",
    code: "Confirme sua identidade",
    password: "Crie uma nova senha",
    success: "Senha alterada",
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="Fechar alteração de senha"
          className={styles.closeButton}
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          <XIcon aria-hidden size={20} weight="bold" />
        </button>

        <span className={styles.icon}>
          {step === "success"
            ? <CheckCircleIcon aria-hidden size={27} weight="duotone" />
            : step === "password"
              ? <ShieldCheckIcon aria-hidden size={27} weight="duotone" />
              : <LockKeyIcon aria-hidden size={27} weight="duotone" />}
        </span>
        <p className={styles.eyebrow}>Segurança da conta</p>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>{titles[step]}</h2>
        <p className={styles.description} id={descriptionId}>
          {step === "request" && `Enviaremos um código de confirmação para ${email}.`}
          {step === "code" && `Digite o código de seis dígitos enviado para ${email}.`}
          {step === "password" && "Use pelo menos 8 caracteres, incluindo letra, número e símbolo."}
          {step === "success" && "Sua nova senha foi salva e sua sessão atual permanece ativa."}
        </p>

        {step === "request" && (
          <div className={styles.form}>
            {message && <p className="app-feedback app-feedback--error" role="alert">{message}</p>}
            <ActionButton disabled={pending} onClick={() => void requestCode()} type="button">
              {pending ? "Enviando..." : "Enviar código"}
            </ActionButton>
            <ActionButton disabled={pending} onClick={onClose} type="button" variant="secondary">
              Cancelar alteração
            </ActionButton>
          </div>
        )}

        {step === "code" && (
          <form className={styles.form} noValidate onSubmit={verifyCode}>
            <VerificationCodeFields
              code={code}
              error={message}
              onChange={(nextCode) => {
                setCode(nextCode);
                setMessage("");
              }}
            />
            {message && <p className="app-feedback app-feedback--error" role="alert">{message}</p>}
            <div className={styles.resendRow}>
              {timeLeft > 0 ? (
                <span>Reenvie em {minutes}:{seconds}</span>
              ) : (
                <button disabled={pending} onClick={() => void requestCode()} type="button">
                  Reenviar código
                </button>
              )}
            </div>
            <ActionButton disabled={pending} type="submit">
              {pending ? "Validando..." : "Validar código"}
            </ActionButton>
            <ActionButton disabled={pending} onClick={onClose} type="button" variant="secondary">
              Cancelar alteração
            </ActionButton>
          </form>
        )}

        {step === "password" && (
          <form className={styles.form} noValidate onSubmit={savePassword}>
            <FormField
              autoComplete="new-password"
              error={errors.password}
              icon="lock"
              label="Nova senha"
              minLength={8}
              name="profile-new-password"
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
              }}
              onToggle={() => setShowPassword((current) => !current)}
              placeholder="8+ caracteres, número e símbolo"
              toggleLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <FormField
              autoComplete="new-password"
              error={errors.confirmPassword}
              icon="lock"
              label="Confirmar nova senha"
              minLength={8}
              name="profile-confirm-new-password"
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirmPassword: "" }));
              }}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              placeholder="Digite a senha novamente"
              toggleLabel={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
            />
            {message && <p className="app-feedback app-feedback--error" role="alert">{message}</p>}
            <ActionButton disabled={pending} type="submit">
              {pending ? "Salvando..." : "Salvar nova senha"}
            </ActionButton>
            <ActionButton disabled={pending} onClick={onClose} type="button" variant="secondary">
              Cancelar alteração
            </ActionButton>
          </form>
        )}

        {step === "success" && (
          <ActionButton onClick={onClose} type="button">Concluir</ActionButton>
        )}
      </section>
    </div>
  );
}
