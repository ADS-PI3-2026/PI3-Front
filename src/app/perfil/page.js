"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  EnvelopeSimple,
  FloppyDisk,
  GearSix,
  IdentificationCard,
  Phone,
  ShieldCheck,
  SignOut,
  Trash,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import AppShell from "../components/app-shell";
import { submitJsonRequest } from "../app-api";
import { clearAuthSession } from "../auth-session";
import { mockUser } from "../mock-data";
import styles from "./page.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PROFILE_TABS = [
  { id: "settings", label: "Alterar configurações", Icon: GearSix },
  { id: "privacy", label: "Privacidade e termos", Icon: ShieldCheck },
  { id: "access", label: "Acesso à conta", Icon: SignOut },
  { id: "deletion", label: "Excluir conta", Icon: Trash },
];

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function ProfileField({ error, Icon, label, ...inputProps }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={`${styles.inputShell} ${error ? styles.inputError : ""}`}>
        <Icon aria-hidden size={20} weight="regular" />
        <input aria-invalid={Boolean(error)} {...inputProps} />
      </span>
      {error && <small className={styles.fieldError}>{error}</small>}
    </label>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: mockUser.name,
    email: mockUser.email,
    phone: mockUser.phone,
  });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedJson, setSubmittedJson] = useState(null);
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [activeTab, setActiveTab] = useState("settings");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const tabRefs = useRef([]);

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

  const update = (key) => (event) => {
    const value = key === "phone" ? formatPhone(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setMessage("");
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    const email = form.email.trim().toLowerCase();
    const phone = onlyDigits(form.phone);
    const nextErrors = {};

    if (name.split(" ").filter(Boolean).length < 2) {
      nextErrors.name = "Informe nome e sobrenome.";
    }
    if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Digite um e-mail válido.";
    }
    if (phone.length !== 11) {
      nextErrors.phone = "Digite um celular com DDD.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name,
      email,
      phone,
      document_type: mockUser.personType === "PJ" ? "CNPJ" : "CPF",
      document: onlyDigits(mockUser.document),
    };

    setPending(true);
    setMessage("");
    try {
      const result = await submitJsonRequest("/users/me", {
        method: "PATCH",
        payload,
      });
      setSubmittedJson(payload);
      setSubmittedFrom("settings");
      setMessage(result.mode === "preview"
        ? "Dados validados. O JSON está pronto para a futura API."
        : "Perfil atualizado com sucesso.");
    } catch {
      setMessage("Não foi possível atualizar o perfil. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  const submitDeletionRequest = async (event) => {
    event.preventDefault();
    if (deletionConfirmation !== "EXCLUIR") {
      setDeletionMessage("Digite EXCLUIR para confirmar a solicitação.");
      return;
    }

    const payload = {
      user_id: mockUser.id,
      reason: "user_request",
      anonymize_personal_data: true,
    };

    setPending(true);
    setDeletionMessage("");
    try {
      const result = await submitJsonRequest("/users/me/deletion-requests", {
        method: "POST",
        payload,
      });
      setSubmittedJson(payload);
      setSubmittedFrom("deletion");
      setDeletionMessage(result.mode === "preview"
        ? "Solicitação validada em modo de pré-visualização."
        : "Solicitação enviada com sucesso.");
      setDeletionConfirmation("");
    } catch {
      setDeletionMessage("Não foi possível enviar a solicitação.");
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
            <h2>{mockUser.name}</h2>
            <p>{mockUser.email}</p>
            <span>{mockUser.personType === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</span>
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
                  <h2>Alterar configurações</h2>
                </div>
                <GearSix aria-hidden size={27} weight="duotone" />
              </div>

              <form className={styles.form} noValidate onSubmit={submitProfile}>
                <ProfileField
                  autoComplete="name"
                  error={errors.name}
                  Icon={UserCircle}
                  label="Nome completo"
                  maxLength={100}
                  name="name"
                  onChange={update("name")}
                  value={form.name}
                />
                <ProfileField
                  autoComplete="email"
                  error={errors.email}
                  Icon={EnvelopeSimple}
                  label="E-mail"
                  maxLength={254}
                  name="email"
                  onChange={update("email")}
                  type="email"
                  value={form.email}
                />
                <ProfileField
                  autoComplete="tel"
                  error={errors.phone}
                  Icon={Phone}
                  inputMode="numeric"
                  label="Celular"
                  maxLength={15}
                  name="phone"
                  onChange={update("phone")}
                  value={form.phone}
                />
                <ProfileField
                  Icon={IdentificationCard}
                  label={mockUser.personType === "PJ" ? "CNPJ" : "CPF"}
                  name="document"
                  readOnly
                  value={mockUser.document}
                />

                {message && (
                  <p className={message.includes("Não foi") ? styles.errorMessage : styles.successMessage}>
                    {message.includes("Não foi")
                      ? <WarningCircle aria-hidden size={20} weight="fill" />
                      : <CheckCircle aria-hidden size={20} weight="fill" />}
                    {message}
                  </p>
                )}

                <button className={styles.primaryButton} disabled={pending} type="submit">
                  <FloppyDisk aria-hidden size={21} weight="bold" />
                  {pending ? "Preparando JSON..." : "Salvar alterações"}
                </button>
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
              <button className={styles.secondaryButton} onClick={logout} type="button">
                <SignOut aria-hidden size={20} weight="bold" />
                Sair da conta
              </button>
            </section>
          )}

          {activeTab === "deletion" && (
            <section className={`${styles.card} ${styles.dangerCard}`}>
              <div className={`${styles.cardHeading} ${styles.dangerHeading}`}>
                <div>
                  <p>Zona de atenção</p>
                  <h2>Excluir minha conta</h2>
                </div>
                <Trash aria-hidden size={27} weight="duotone" />
              </div>
              <form className={styles.deletionForm} onSubmit={submitDeletionRequest}>
                <p>O pedido será enviado para anonimizar seus dados pessoais, preservando o histórico dos veículos.</p>
                <label className={styles.field}>
                  <span>Digite EXCLUIR para continuar</span>
                  <span className={styles.inputShell}>
                    <WarningCircle aria-hidden size={20} weight="regular" />
                    <input
                      autoComplete="off"
                      onChange={(event) => {
                        setDeletionConfirmation(event.target.value.toUpperCase());
                        setDeletionMessage("");
                      }}
                      value={deletionConfirmation}
                    />
                  </span>
                </label>
                {deletionMessage && <p className={styles.deletionMessage}>{deletionMessage}</p>}
                <button className={styles.deleteButton} disabled={pending} type="submit">
                  <Trash aria-hidden size={20} weight="bold" />
                  Solicitar exclusão
                </button>
              </form>
            </section>
          )}
        </div>
      </div>

      {submittedJson && submittedFrom === activeTab && (
        <details className={styles.jsonPreview}>
          <summary>Ver último JSON preparado</summary>
          <pre>{JSON.stringify(submittedJson, null, 2)}</pre>
        </details>
      )}
    </AppShell>
  );
}
