"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GearSix,
  ShieldCheck,
  SignOut,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import ActionButton from "../components/action-button";
import AppShell, { useAuthUser } from "../components/app-shell";
import FormField from "../components/form-field";
import VerificationCodeFields from "../components/verification-code-fields";
import { getAuthErrorMessage, getAuthFieldErrors } from "../auth-api";
import { deleteAccount, requestAccountDeletionCode, validateAccountDeletionCode } from "../account-api";
import { logoutAuthSession } from "../session-api";
import { CODE_RESEND_WAIT_SECONDS, createEmptyCode } from "../lib/form-validation";
import styles from "./page.module.css";

const PROFILE_TABS = [
  { id: "settings", label: "Dados pessoais", Icon: GearSix },
  { id: "privacy", label: "Privacidade e termos", Icon: ShieldCheck },
  { id: "access", label: "Acesso à conta", Icon: SignOut },
  { id: "deletion", label: "Excluir conta", Icon: Trash },
];

export default function ProfilePage() {
  return <AppShell><ProfileContent /></AppShell>;
}

function ProfileContent() {
  const user = useAuthUser();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [deletionStep, setDeletionStep] = useState("request");
  const [deletionCode, setDeletionCode] = useState(createEmptyCode);
  const [actionToken, setActionToken] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [deletionTimeLeft, setDeletionTimeLeft] = useState(0);
  const [sentAt, setSentAt] = useState(0);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!sentAt) return;
    const timer = window.setInterval(() => {
      setDeletionTimeLeft(Math.max(0, CODE_RESEND_WAIT_SECONDS - Math.floor((Date.now() - sentAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

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

  const requestDeletionCode = async () => {
    if (pending || Date.now() - sentAt < CODE_RESEND_WAIT_SECONDS * 1000) return;
    setPending(true);
    setDeletionMessage("");
    try {
      await requestAccountDeletionCode();
      setDeletionCode(createEmptyCode());
      setActionToken("");
      setSentAt(Date.now());
      setDeletionTimeLeft(CODE_RESEND_WAIT_SECONDS);
      setDeletionStep("code");
    } catch (error) {
      setDeletionMessage(getAuthErrorMessage(error, "Não foi possível enviar o código. Tente novamente."));
    } finally { setPending(false); }
  };

  const verifyDeletionCode = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setDeletionMessage("");
    try {
      const token = await validateAccountDeletionCode(deletionCode.join(""));
      setActionToken(token);
      setDeletionCode(createEmptyCode());
      setDeletionStep("confirm");
    } catch (error) {
      setDeletionMessage(getAuthFieldErrors(error).code ?? getAuthErrorMessage(error, "O código não pôde ser validado. Tente novamente."));
    } finally { setPending(false); }
  };

  const submitDeletionRequest = async (event) => {
    event.preventDefault();
    if (pending) return;
    if (deletionConfirmation !== "DELETAR") {
      setDeletionMessage("Digite DELETAR para confirmar a exclusão.");
      return;
    }
    setPending(true);
    setDeletionMessage("");
    try {
      await deleteAccount(actionToken);
      router.replace("/?account=deleted");
    } catch (error) {
      setActionToken("");
      setDeletionConfirmation("");
      setDeletionStep("request");
      setDeletionMessage(`${getAuthErrorMessage(error, "Não foi possível excluir a conta.")} Solicite um novo código para confirmar outra tentativa.`);
    } finally { setPending(false); }
  };

  const logout = async () => {
    if (pending) return;
    setPending(true);
    try {
      await logoutAuthSession();
      router.replace("/");
    } catch {
      router.replace("/?session=logout-unconfirmed");
    } finally { setPending(false); }
  };

  return (
    <>
      <header className={`app-page-header ${styles.pageHeader}`}>
        <div>
          <p>Conta e privacidade</p>
          <h1 className="app-page-title">Configurações do perfil</h1>
        </div>
        <UserCircle aria-hidden size={36} weight="fill" />
      </header>

      <div className={styles.profileLayout}>
        <section className={`app-card ${styles.profileSummary}`}>
          <div className={styles.avatar}>
            <UserCircle aria-hidden size={58} weight="duotone" />
          </div>
          <div>
            <h2>{user.name}</h2>
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
            <section className={`app-card ${styles.card}`}>
              <div className={styles.cardHeading}>
                <div>
                  <p>Dados cadastrais</p>
                  <h2>Meus dados pessoais</h2>
                </div>
                <GearSix aria-hidden size={27} weight="duotone" />
              </div>

              <div className={styles.form}>
                <FormField autoComplete="name" Icon={UserCircle} label="Nome" name="name" readOnly value={user.name} />
                <FormField autoComplete="email" icon="envelope" label="E-mail" name="email" readOnly value={user.email} />
                <FormField icon="idCard" label={user.document_type || "Documento"} name="document" readOnly value={user.document || ""} />
                <p className={styles.panelDescription}>A edição dos dados pessoais ainda não está disponível.</p>
              </div>
            </section>
          )}

          {activeTab === "privacy" && (
            <section className={`app-card ${styles.card}`}>
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
            <section className={`app-card ${styles.card}`}>
              <div className={styles.cardHeading}>
                <div>
                  <p>Sessão</p>
                  <h2>Acesso à conta</h2>
                </div>
                <SignOut aria-hidden size={27} weight="duotone" />
              </div>
              <p className={styles.panelDescription}>Encerre com segurança a sessão atual neste dispositivo.</p>
              <ActionButton disabled={pending} onClick={logout} type="button" variant="secondary">
                <SignOut aria-hidden size={20} weight="bold" />
                {pending ? "Saindo..." : "Sair da conta"}
              </ActionButton>
            </section>
          )}

          {activeTab === "deletion" && (
            <section className={`app-card ${styles.card} ${styles.dangerCard}`}>
              <div className={`${styles.cardHeading} ${styles.dangerHeading}`}>
                <div>
                  <h2>Excluir minha conta</h2>
                </div>
                <Trash aria-hidden size={27} weight="duotone" />
              </div>

              {deletionStep === "request" && (
                <div className={styles.deletionForm}>
                  <p>Antes da exclusão, enviaremos um código de confirmação para o e-mail cadastrado da conta.</p>
                  {deletionMessage && <p className={styles.deletionMessage} role="alert">{deletionMessage}</p>}
                  <ActionButton disabled={pending || deletionTimeLeft > 0} onClick={requestDeletionCode} type="button" variant="danger">
                    {pending ? "Enviando código..." : deletionTimeLeft > 0 ? `Aguarde ${deletionMinutes}:${deletionSeconds}` : "Enviar código de confirmação"}
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
                  {deletionMessage && <p className={styles.deletionMessage} role="alert">{deletionMessage}</p>}
                  <div className={styles.resendRow}>
                    {deletionTimeLeft > 0 ? (
                      <span>Reenvie em {deletionMinutes}:{deletionSeconds}</span>
                    ) : (
                      <button disabled={pending} onClick={requestDeletionCode} type="button">Reenviar código</button>
                    )}
                  </div>
                  <ActionButton disabled={pending} type="submit" variant="danger">
                    {pending ? "Validando..." : "Validar código"}
                  </ActionButton>
                </form>
              )}

              {deletionStep === "confirm" && (
                <form className={styles.deletionForm} onSubmit={submitDeletionRequest}>
                  <p>Código confirmado. Para concluir a exclusão da sua conta, digite DELETAR. Seus dados pessoais serão removidos e você perderá o acesso à conta.</p>
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
                  {deletionMessage && <p className={styles.deletionMessage} role="alert">{deletionMessage}</p>}
                  <ActionButton disabled={pending} type="submit" variant="danger">
                    <Trash aria-hidden size={20} weight="bold" />
                    {pending ? "Excluindo..." : "Confirmar exclusão"}
                  </ActionButton>
                </form>
              )}

            </section>
          )}
        </div>
      </div>
    </>
  );
}
