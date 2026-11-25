"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CarIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  LockKeyIcon,
  PencilSimpleIcon,
  ShieldCheckIcon,
  SignOutIcon,
  TrashIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import ActionButton from "../components/action-button";
import AppShell, { useAuthUser } from "../components/app-shell";
import FormField from "../components/form-field";
import LegalDialog from "../components/legal-dialog";
import { usePwaInstall } from "../components/pwa-provider";
import { useToast } from "../components/toast-provider";
import VerificationCodeFields from "../components/verification-code-fields";
import { getAuthErrorMessage, getAuthFieldErrors } from "../auth-api";
import { deleteAccount, requestAccountDeletionCode, validateAccountDeletionCode } from "../account-api";
import { logoutAuthSession } from "../session-api";
import { CODE_RESEND_WAIT_SECONDS, createEmptyCode, formatCpf, formatCnpj } from "../lib/form-validation";
import {
  clearPendingOtpRequest,
  readPendingOtpRequest,
  savePendingOtpRequest,
} from "../lib/otp-request-state";
import EmailChangeDialog from "./email-change-dialog";
import PasswordChangeDialog from "./password-change-dialog";
import { startProfileSync } from "./profile-sync";
import styles from "./page.module.css";

const PROFILE_TABS = [
  { id: "settings", label: "Dados pessoais", Icon: UserCircleIcon },
  { id: "privacy", label: "Privacidade e termos", Icon: ShieldCheckIcon },
  { id: "access", label: "Acesso à conta", Icon: SignOutIcon },
  { id: "install", label: "Instalar aplicativo", Icon: DownloadSimpleIcon },
  { id: "deletion", label: "Excluir conta", Icon: TrashIcon, danger: true },
];

const ACCOUNT_DELETION_OTP_PURPOSE = "account_deletion";

export default function ProfilePage() {
  return <AppShell><ProfileContent /></AppShell>;
}

function ProfileContent() {
  const user = useAuthUser();
  const pwa = usePwaInstall();
  const { showToast } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const profileSync = useRef(null);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const closeEmailChange = useCallback(() => setEmailChangeOpen(false), []);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeRequest, setPasswordChangeRequest] = useState({
    sentAt: 0,
    verifiedAt: 0,
  });
  const [legalOpen, setLegalOpen] = useState(null);
  const closeLegal = useCallback(() => setLegalOpen(null), []);
  const [activeTab, setActiveTab] = useState("");
  const [deletionStep, setDeletionStep] = useState("request");
  const [deletionCode, setDeletionCode] = useState(createEmptyCode);
  const [actionToken, setActionToken] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [deletionTimeLeft, setDeletionTimeLeft] = useState(0);
  const [sentAt, setSentAt] = useState(0);
  const tabRefs = useRef([]);
  const formattedDocument = user.document_type === "CNPJ"
    ? formatCnpj(String(user.document ?? ""))
    : formatCpf(String(user.document ?? ""));
  const profileSections = PROFILE_TABS.filter(({ id }) => (
    id !== "install" || !pwa.installed
  ));
  const selectedSection = pwa.installed && activeTab === "install" ? "access" : activeTab;

  useEffect(() => {
    const sync = startProfileSync(setProfileMessage);
    profileSync.current = sync;
    return () => {
      profileSync.current = null;
      sync.stop();
    };
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const pendingRequest = readPendingOtpRequest(ACCOUNT_DELETION_OTP_PURPOSE);
      if (!pendingRequest) return;
      setActiveTab("deletion");
      setDeletionStep("code");
      setDeletionCode(createEmptyCode());
      setSentAt(pendingRequest.requestedAt);
    });
    return () => { active = false; };
  }, []);

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

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % profileSections.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + profileSections.length) % profileSections.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = PROFILE_TABS.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(profileSections[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const requestDeletionCode = async () => {
    if (pending || Date.now() - sentAt < CODE_RESEND_WAIT_SECONDS * 1000) return;
    setPending(true);
    setDeletionMessage("");
    try {
      await requestAccountDeletionCode();
      savePendingOtpRequest(ACCOUNT_DELETION_OTP_PURPOSE);
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
      clearPendingOtpRequest(ACCOUNT_DELETION_OTP_PURPOSE);
      setActionToken(token);
      setDeletionCode(createEmptyCode());
      setDeletionStep("confirm");
    } catch (error) {
      setDeletionMessage(getAuthFieldErrors(error).code ?? getAuthErrorMessage(error, "O código não pôde ser validado. Tente novamente."));
    } finally { setPending(false); }
  };

  const cancelAccountDeletion = () => {
    clearPendingOtpRequest(ACCOUNT_DELETION_OTP_PURPOSE);
    setDeletionCode(createEmptyCode());
    setActionToken("");
    setDeletionConfirmation("");
    setDeletionMessage("");
    setDeletionTimeLeft(0);
    setSentAt(0);
    setDeletionStep("request");
  };

  const cancelAndCloseAccountDeletion = () => {
    cancelAccountDeletion();
    setActiveTab("");
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

  const installApp = async () => {
    const outcome = await pwa.install();
    if (outcome === "accepted") {
      showToast({ message: "A instalação do LegadoCar foi iniciada.", tone: "success" });
    } else if (outcome === "dismissed") {
      showToast({
        message: "A instalação foi cancelada. Você poderá tentar novamente pelo menu do navegador.",
        tone: "info",
      });
    }
  };

  const panelBySection = {
    settings: (
      <section className={styles.panelContent}>
        <div className={styles.sectionSummaryRow}>
          <p className={styles.sectionSummary}>
            Consulte seus dados cadastrados e altere o e-mail da conta quando necessário.
          </p>
          <button
            className={styles.editEmailButton}
            onClick={() => setEmailChangeOpen(true)}
            type="button"
          >
            <PencilSimpleIcon aria-hidden size={17} weight="bold" />
            Alterar e-mail
          </button>
        </div>

        <div className={styles.form}>
          <FormField autoComplete="name" disabled Icon={UserCircleIcon} label="Nome" name="name" value={user.name} />
          <FormField
            autoComplete="email"
            disabled
            icon="envelope"
            label="E-mail"
            name="email"
            value={user.email}
          />
          <FormField disabled icon="idCard" label={user.document_type || "Documento"} name="document" value={formattedDocument} />
        </div>
      </section>
    ),
    privacy: (
      <section className={styles.panelContent}>
        <p className={styles.sectionSummary}>Consulte os documentos que explicam o uso da plataforma e o tratamento dos seus dados.</p>
        <div className={styles.linkList}>
          <button aria-haspopup="dialog" onClick={() => setLegalOpen("terms")} type="button">
            <span>Termos de Uso</span>
            <CaretRightIcon aria-hidden size={18} weight="bold" />
          </button>
          <button aria-haspopup="dialog" onClick={() => setLegalOpen("privacy")} type="button">
            <span>Política de Privacidade</span>
            <CaretRightIcon aria-hidden size={18} weight="bold" />
          </button>
        </div>
      </section>
    ),
    access: (
      <section className={styles.panelContent}>
        <p className={styles.sectionSummary}>Altere sua senha ou encerre com segurança a sessão atual neste dispositivo.</p>
        <div className={styles.accessActions}>
          <button className={styles.editEmailButton} onClick={() => setPasswordChangeOpen(true)} type="button">
            <LockKeyIcon aria-hidden size={17} weight="bold" />
            Alterar senha
          </button>
          <button className={styles.editEmailButton} disabled={pending} onClick={logout} type="button">
            <SignOutIcon aria-hidden size={17} weight="bold" />
            {pending ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </section>
    ),
    install: (
      <section className={styles.panelContent}>
        <div className={styles.cardHeading}>
          <div>
            <h2>Instale o LegadoCar</h2>
          </div>
          <DownloadSimpleIcon aria-hidden size={27} weight="duotone" />
        </div>
        <p className={styles.panelDescription}>
          Acesse sua garagem como um aplicativo, sem precisar abrir o navegador.
        </p>
        {pwa.installed ? (
          <p className={styles.installedMessage}>
            O LegadoCar já está instalado neste dispositivo.
          </p>
        ) : pwa.canInstall ? (
          <ActionButton onClick={() => void installApp()} type="button" variant="success">
            <DownloadSimpleIcon aria-hidden size={20} weight="bold" />
            Instalar aplicativo
          </ActionButton>
        ) : (
          <p className={styles.installUnavailableMessage}>
            A instalação automática não está disponível neste navegador. Procure a opção
            “Instalar aplicativo” ou “Adicionar à tela inicial” no menu do navegador.
          </p>
        )}
      </section>
    ),
    deletion: (
      <section className={`${styles.panelContent} ${styles.dangerContent}`}>
        <div className={`${styles.cardHeading} ${styles.dangerHeading}`}>
          <div>
            <h2>Excluir minha conta</h2>
          </div>
          <TrashIcon aria-hidden size={27} weight="duotone" />
        </div>

        {deletionStep === "request" && (
          <div className={`${styles.deletionForm} ${styles.deletionRequest}`}>
            <p>Antes da exclusão, enviaremos um código de confirmação para o e-mail cadastrado da conta</p>
            {deletionMessage && <p className={styles.deletionMessage} role="alert">{deletionMessage}</p>}
            <ActionButton disabled={pending || deletionTimeLeft > 0} onClick={requestDeletionCode} type="button" variant="danger">
              {pending ? "Enviando código..." : deletionTimeLeft > 0 ? `Aguarde ${deletionMinutes}:${deletionSeconds}` : "Enviar código de confirmação"}
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={cancelAndCloseAccountDeletion}
              type="button"
              variant="secondary"
            >
              <XIcon aria-hidden size={20} weight="bold" />
              Cancelar exclusão
            </ActionButton>
          </div>
        )}

        {deletionStep === "code" && (
          <form className={styles.deletionForm} noValidate onSubmit={verifyDeletionCode}>
            <p>Digite o código de seis dígitos enviado para o e-mail cadastrado</p>
            <p>O código permanece válido por até 10 minutos após o envio.</p>
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
            <ActionButton
              disabled={pending}
              onClick={cancelAndCloseAccountDeletion}
              type="button"
              variant="secondary"
            >
              <XIcon aria-hidden size={20} weight="bold" />
              Cancelar exclusão
            </ActionButton>
          </form>
        )}

        {deletionStep === "confirm" && (
          <form className={styles.deletionForm} onSubmit={submitDeletionRequest}>
            <p>Código confirmado. Para concluir a exclusão da sua conta, digite DELETAR. Seus dados pessoais serão removidos e você perderá o acesso à conta</p>
            <FormField
              autoComplete="off"
              Icon={WarningCircleIcon}
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
              <TrashIcon aria-hidden size={20} weight="bold" />
              {pending ? "Excluindo..." : "Confirmar exclusão"}
            </ActionButton>
            <ActionButton
              disabled={pending}
              onClick={cancelAndCloseAccountDeletion}
              type="button"
              variant="secondary"
            >
              <XIcon aria-hidden size={20} weight="bold" />
              Cancelar exclusão
            </ActionButton>
          </form>
        )}
      </section>
    ),
  };

  return (
    <>
      <header className={`app-page-header ${styles.pageHeader}`}>
        <div>
          <p>Conta e privacidade</p>
          <h1 className="app-page-title">Perfil</h1>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.garageLink} href="/garagem">
            <CarIcon aria-hidden size={21} weight="bold" />
            Garagem
          </Link>
        </div>
      </header>

      {profileMessage && (
        <div className="app-feedback app-feedback--error" role="status">
          <p>{profileMessage}</p>
          <button onClick={() => void profileSync.current?.refresh()} type="button">Tentar novamente</button>
        </div>
      )}

      <div className={styles.profileLayout}>
        <section className={`app-card ${styles.profileSummary}`}>
            <div className={styles.avatar}>
              <UserCircleIcon aria-hidden size={58} weight="duotone" />
            </div>
            <div className={styles.profileIdentity}>
              <h2>{user.name}</h2>
            </div>
        </section>

        <div aria-label="Configurações do perfil" className={`app-card ${styles.accordion}`}>
            {profileSections.map(({ id, label, Icon, danger }, index) => (
              <section className={styles.accordionItem} data-danger={danger || undefined} key={id}>
                <h2>
                  <button
                    aria-controls={`profile-panel-${id}`}
                    aria-expanded={selectedSection === id}
                    className={selectedSection === id ? styles.activeTab : styles.tabButton}
                    data-danger={danger || undefined}
                    id={`profile-trigger-${id}`}
                    onClick={() => setActiveTab((current) => current === id ? "" : id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    type="button"
                  >
                    <span className={styles.tabIcon}>
                      <Icon aria-hidden size={20} weight={selectedSection === id ? "fill" : "regular"} />
                    </span>
                    <span className={styles.tabLabel}>{label}</span>
                    <CaretRightIcon aria-hidden className={styles.tabCaret} size={17} weight="bold" />
                  </button>
                </h2>
                {selectedSection === id && (
                  <div
                    aria-labelledby={`profile-trigger-${id}`}
                    className={styles.accordionPanel}
                    id={`profile-panel-${id}`}
                    role="region"
                  >
                    {panelBySection[id]}
                  </div>
                )}
              </section>
            ))}
        </div>
      </div>
      {emailChangeOpen && <EmailChangeDialog onClose={closeEmailChange} user={user} />}
      {passwordChangeOpen && (
        <PasswordChangeDialog
          email={user.email}
          onClose={() => setPasswordChangeOpen(false)}
          onRequestChange={setPasswordChangeRequest}
          request={passwordChangeRequest}
        />
      )}
      {legalOpen && <LegalDialog onClose={closeLegal} type={legalOpen} />}
    </>
  );
}
