"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  FloppyDisk,
  GearSix,
  ShieldCheck,
  SignOut,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import ActionButton from "../components/action-button";
import AppShell from "../components/app-shell";
import FormField from "../components/form-field";
import VerificationCodeFields from "../components/verification-code-fields";
import { submitJsonRequest } from "../app-api";
import { clearAuthSession, getAuthSession } from "../auth-session";
import {
  CODE_RESEND_WAIT_SECONDS,
  VERIFICATION_CODE_LENGTH,
  createEmptyCode,
  getAccountNameValidationError,
} from "../lib/form-validation";
import { mockUser } from "../mock-data";
import styles from "./page.module.css";

const PROFILE_TABS = [
  { id: "settings", label: "Alterar dados pessoais", Icon: GearSix },
  { id: "privacy", label: "Privacidade e termos", Icon: ShieldCheck },
  { id: "access", label: "Acesso à conta", Icon: SignOut },
  { id: "deletion", label: "Excluir conta", Icon: Trash },
];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: mockUser.name,
  });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedJson, setSubmittedJson] = useState(null);
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  const [deletionStep, setDeletionStep] = useState("request");
  const [deletionCode, setDeletionCode] = useState(createEmptyCode);
  const [verifiedDeletionCode, setVerifiedDeletionCode] = useState("");
  const [deletionVerificationToken, setDeletionVerificationToken] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [deletionTimeLeft, setDeletionTimeLeft] = useState(0);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (deletionStep !== "code" || deletionTimeLeft <= 0) return;
    const timer = window.setInterval(() => {
      setDeletionTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deletionStep, deletionTimeLeft]);

  const deletionSeconds = String(deletionTimeLeft % 60).padStart(2, "0");
  const deletionMinutes = String(Math.floor(deletionTimeLeft / 60)).padStart(2, "0");

  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % PROFILE_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = PROFILE_TABS.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(PROFILE_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const updateName = (event) => {
    setForm({ name: event.target.value });
    setErrors({});
    setMessage("");
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    const nextErrors = {};

    const nameError = getAccountNameValidationError(name);
    if (nameError) nextErrors.name = nameError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = { name };

    setPending(true);
    setMessage("");
    try {
      const result = await submitJsonRequest("/users/me", {
        accessToken: getAuthSession()?.accessToken,
        method: "PATCH",
        payload,
      });
      setSubmittedJson(payload);
      setSubmittedFrom("settings");
      setForm({ name });
      setMessage(result.mode === "preview"
        ? "Dados validados. O JSON está pronto para a futura API."
        : "Perfil atualizado com sucesso.");
    } catch {
      setMessage("Não foi possível atualizar o perfil. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const requestDeletionCode = async () => {
    setPending(true);
    setDeletionMessage("");
    try {
      await submitJsonRequest("/users/me/deletion-otp", {
        accessToken: getAuthSession()?.accessToken,
        method: "POST",
        payload: { purpose: "account_deletion" },
      });
      setDeletionCode(createEmptyCode());
      setDeletionTimeLeft(CODE_RESEND_WAIT_SECONDS);
      setDeletionStep("code");
    } catch {
      setDeletionMessage("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const verifyDeletionCode = async (event) => {
    event.preventDefault();
    const otpCode = deletionCode.join("");
    if (otpCode.length !== VERIFICATION_CODE_LENGTH) {
      setDeletionMessage("Digite os seis números enviados para o seu e-mail cadastrado.");
      return;
    }

    setPending(true);
    setDeletionMessage("");
    try {
      const result = await submitJsonRequest("/users/me/deletion-otp/verify", {
        accessToken: getAuthSession()?.accessToken,
        method: "POST",
        payload: { code: otpCode, purpose: "account_deletion" },
      });
      setVerifiedDeletionCode(otpCode);
      setDeletionVerificationToken(
        result?.data?.verification_token
        ?? result?.data?.token
        ?? "",
      );
      setDeletionStep("confirm");
    } catch {
      setDeletionMessage("O código não pôde ser validado. Confira e tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const resendDeletionCode = async () => {
    if (deletionTimeLeft > 0) return;
    await requestDeletionCode();
  };

  const submitDeletionRequest = async (event) => {
    event.preventDefault();
    if (deletionConfirmation !== "DELETAR") {
      setDeletionMessage("Digite DELETAR para confirmar a exclusão.");
      return;
    }

    const payload = {
      confirmation: "DELETAR",
      otp_code: verifiedDeletionCode,
      anonymize_personal_data: true,
      ...(deletionVerificationToken ? { verification_token: deletionVerificationToken } : {}),
    };

    setPending(true);
    setDeletionMessage("");
    try {
      const result = await submitJsonRequest("/users/me", {
        accessToken: getAuthSession()?.accessToken,
        method: "DELETE",
        payload,
      });
      setSubmittedJson(payload);
      setSubmittedFrom("deletion");
      setDeletionConfirmation("");
      if (result.mode === "preview") {
        setDeletionMessage("Exclusão validada em modo de pré-visualização. Nenhum dado foi removido.");
        setDeletionStep("success");
      } else {
        clearAuthSession();
        router.replace("/");
      }
    } catch {
      setDeletionMessage("Não foi possível excluir a conta. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const logout = () => {
    clearAuthSession();
    router.replace("/");
  };

  return (
    <AppShell>
      <header className={styles.pageHeader}>
        <div>
          <p>Conta e privacidade</p>
          <h1>Configurações do perfil</h1>
        </div>
        <UserCircle aria-hidden size={36} weight="fill" />
      </header>

      <div className={styles.profileLayout}>
        <section className={styles.profileSummary}>
          <div className={styles.avatar}>
            <UserCircle aria-hidden size={58} weight="duotone" />
          </div>
          <div>
            <h2>{form.name || mockUser.name}</h2>
          </div>
        </section>

        <div aria-label="Seções do perfil" className={styles.tabList} role="tablist">
          {PROFILE_TABS.map(({ id, label, Icon }, index) => (
            <button
              aria-controls={`profile-panel-${id}`}
              aria-selected={activeTab === id}
              className={activeTab === id ? styles.activeTab : styles.tabButton}
              id={`profile-tab-${id}`}
              key={id}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => { tabRefs.current[index] = element; }}
              role="tab"
              tabIndex={activeTab === id ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden size={20} weight={activeTab === id ? "fill" : "regular"} />
              {label}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`profile-tab-${activeTab}`}
          className={styles.tabPanel}
          id={`profile-panel-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab === "settings" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <p>Dados cadastrais</p>
                  <h2>Alterar dados pessoais</h2>
                </div>
                <GearSix aria-hidden size={27} weight="duotone" />
              </div>

              <form className={styles.form} noValidate onSubmit={submitProfile}>
                <FormField
                  autoComplete="name"
                  error={errors.name}
                  Icon={UserCircle}
                  label="Nome"
                  maxLength={100}
                  name="name"
                  onChange={updateName}
                  value={form.name}
                />

                {message && (
                  <p className={message.includes("Não foi") ? styles.errorMessage : styles.successMessage}>
                    {message.includes("Não foi")
                      ? <WarningCircle aria-hidden size={20} weight="fill" />
                      : <CheckCircle aria-hidden size={20} weight="fill" />}
                    {message}
                  </p>
                )}

                <ActionButton disabled={pending} type="submit">
                  <FloppyDisk aria-hidden size={21} weight="bold" />
                  {pending ? "Preparando JSON..." : "Salvar alterações"}
                </ActionButton>
              </form>
            </section>
          )}

          {activeTab === "privacy" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <p>Transparência</p>
                  <h2>Privacidade e termos</h2>
                </div>
                <ShieldCheck aria-hidden size={27} weight="duotone" />
              </div>
              <p className={styles.panelDescription}>Consulte os documentos que explicam o uso da plataforma e o tratamento dos seus dados.</p>
              <div className={styles.linkList}>
                <Link href="/?legal=terms&returnTo=%2Fperfil">Termos de Uso</Link>
                <Link href="/?legal=privacy&returnTo=%2Fperfil">Política de Privacidade</Link>
              </div>
            </section>
          )}

          {activeTab === "access" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <p>Sessão</p>
                  <h2>Acesso à conta</h2>
                </div>
                <SignOut aria-hidden size={27} weight="duotone" />
              </div>
              <p className={styles.panelDescription}>Encerre com segurança a sessão atual neste dispositivo.</p>
              <ActionButton onClick={logout} type="button" variant="secondary">
                <SignOut aria-hidden size={20} weight="bold" />
                Sair da conta
              </ActionButton>
            </section>
          )}

          {activeTab === "deletion" && (
            <section className={`${styles.card} ${styles.dangerCard}`}>
              <div className={`${styles.cardHeading} ${styles.dangerHeading}`}>
                <div>
                  <h2>Excluir minha conta</h2>
                </div>
                <Trash aria-hidden size={27} weight="duotone" />
              </div>

              {deletionStep === "request" && (
                <div className={styles.deletionForm}>
                  <p>Antes da exclusão, enviaremos um código OTP para o e-mail cadastrado da conta.</p>
                  {deletionMessage && <p className={styles.deletionMessage}>{deletionMessage}</p>}
                  <ActionButton disabled={pending} onClick={requestDeletionCode} type="button" variant="danger">
                    {pending ? "Enviando código..." : "Enviar código de confirmação"}
                  </ActionButton>
                </div>
              )}

              {deletionStep === "code" && (
                <form className={styles.deletionForm} noValidate onSubmit={verifyDeletionCode}>
                  <p>Digite o código de seis dígitos enviado para o e-mail cadastrado.</p>
                  <VerificationCodeFields
                    code={deletionCode}
                    error={Boolean(deletionMessage)}
                    onChange={(nextCode) => {
                      setDeletionCode(nextCode);
                      setDeletionMessage("");
                    }}
                  />
                  {deletionMessage && <p className={styles.deletionMessage}>{deletionMessage}</p>}
                  <div className={styles.resendRow}>
                    {deletionTimeLeft > 0 ? (
                      <span>Reenvie em {deletionMinutes}:{deletionSeconds}</span>
                    ) : (
                      <button disabled={pending} onClick={resendDeletionCode} type="button">Reenviar código</button>
                    )}
                  </div>
                  <ActionButton disabled={pending} type="submit" variant="danger">
                    {pending ? "Validando..." : "Validar código"}
                  </ActionButton>
                </form>
              )}

              {deletionStep === "confirm" && (
                <form className={styles.deletionForm} onSubmit={submitDeletionRequest}>
                  <p>Código confirmado. Para concluir, digite DELETAR. Essa ação será definitiva quando conectada à API.</p>
                  <FormField
                    autoComplete="off"
                    Icon={WarningCircle}
                    label="Digite DELETAR para continuar"
                    name="deletion-confirmation"
                    onChange={(event) => {
                      setDeletionConfirmation(event.target.value.toUpperCase());
                      setDeletionMessage("");
                    }}
                    value={deletionConfirmation}
                  />
                  {deletionMessage && <p className={styles.deletionMessage}>{deletionMessage}</p>}
                  <ActionButton disabled={pending} type="submit" variant="danger">
                    <Trash aria-hidden size={20} weight="bold" />
                    {pending ? "Excluindo..." : "Confirmar exclusão"}
                  </ActionButton>
                </form>
              )}

              {deletionStep === "success" && (
                <div className={styles.deletionSuccess}>
                  <CheckCircle aria-hidden size={38} weight="duotone" />
                  <p>{deletionMessage}</p>
                  <ActionButton
                    onClick={() => {
                      setDeletionMessage("");
                      setDeletionStep("request");
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Voltar
                  </ActionButton>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
