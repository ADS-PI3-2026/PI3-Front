"use client";

import {
  ArrowsLeftRight,
  CalendarBlank,
  Check,
  CheckCircle,
  ClockCountdown,
  HourglassMedium,
  IdentificationCard,
  ShieldWarning,
} from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "../../../../components/action-button";
import AppShell from "../../../../components/app-shell";
import FormField from "../../../../components/form-field";
import VehicleBrandLogo from "../../../../components/vehicle-brand-logo";
import VehiclePlate from "../../../../components/vehicle-plate";
import VerificationCodeFields from "../../../../components/verification-code-fields";
import {
  createEmptyCode,
  formatCpf,
  getDocumentValidationError,
  isValidEmail,
  onlyDigits,
  VERIFICATION_CODE_LENGTH,
} from "../../../../lib/form-validation";
import { getVehicleById } from "../../../../mock-data";
import PageTopBar from "../../../_components/page-top-bar";
import {
  confirmPreviewTransferParticipant,
  createPreviewTransfer,
  getPreviewTransfer,
  removePreviewTransfer,
  savePreviewTransfer,
  TRANSFER_CONFIRMATION_WINDOW_HOURS,
} from "../../../_lib/vehicle-transfer";
import styles from "./page.module.css";

function validateRecipient(value) {
  const normalizedValue = value.trim();

  if (!normalizedValue) return "Informe o e-mail ou CPF do novo proprietário.";
  if (normalizedValue.includes("@")) {
    return isValidEmail(normalizedValue) ? "" : "Digite um endereço de e-mail válido.";
  }

  return getDocumentValidationError(normalizedValue, "personal");
}

function getRecipientType(value) {
  return value.includes("@") ? "email" : "cpf";
}

function formatRecipientInput(value) {
  if (/^[\d.\-\s]*$/.test(value)) return formatCpf(value);
  return value.slice(0, 254);
}

function maskRecipient(value, recipientType) {
  if (recipientType === "cpf") {
    const digits = onlyDigits(value);
    return `***.***.***-${digits.slice(-2)}`;
  }

  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function formatDeadline(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ParticipantStatus({ confirmed, description, label }) {
  return (
    <div className="app-process-status-row">
      <span className="app-action-icon">
        {confirmed
          ? <CheckCircle aria-hidden size={22} weight="fill" />
          : <HourglassMedium aria-hidden size={22} weight="duotone" />}
      </span>
      <span className="app-process-status-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span
        className={`app-process-status-value ${confirmed ? "app-process-status-value--confirmed" : "app-process-status-value--pending"}`}
      >
        {confirmed ? "Confirmado" : "Aguardando"}
      </span>
    </div>
  );
}

export default function VehicleTransferPage() {
  const params = useParams();
  const router = useRouter();
  const vehicle = getVehicleById(params.id);
  const [recipient, setRecipient] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [transfer, setTransfer] = useState(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState(createEmptyCode);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      setTransfer(getPreviewTransfer(params.id));
      setReady(true);
    }, 0);

    return () => window.clearTimeout(readyTimer);
  }, [params.id]);

  useEffect(() => {
    if (!transfer || transfer.status !== "pending") return undefined;

    const expirationTimer = window.setInterval(() => {
      const currentTransfer = getPreviewTransfer(params.id);
      if (currentTransfer?.status === "expired") setTransfer(currentTransfer);
    }, 30000);

    return () => window.clearInterval(expirationTimer);
  }, [params.id, transfer]);

  if (!vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Transferir veículo" />
        <section className="app-empty-state app-empty-state--narrow">
          <h2>Veículo não encontrado</h2>
          <p>Volte para a garagem e selecione um veículo cadastrado.</p>
        </section>
      </AppShell>
    );
  }

  const startTransfer = (event) => {
    event.preventDefault();
    const recipientError = validateRecipient(recipient);
    const nextErrors = {
      recipient: recipientError,
      consent: accepted ? "" : "Confirme que está ciente das condições da transferência.",
    };

    if (recipientError || nextErrors.consent) {
      setErrors(nextErrors);
      return;
    }

    const recipientType = getRecipientType(recipient);
    const nextTransfer = createPreviewTransfer({
      recipientDisplay: maskRecipient(recipient.trim().toLowerCase(), recipientType),
      vehicleId: vehicle.id,
    });

    savePreviewTransfer(nextTransfer);
    setTransfer(nextTransfer);
    setErrors({});
  };

  const confirmSellerCode = (event) => {
    event.preventDefault();

    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setErrors({ code: "Digite os seis dígitos enviados para você." });
      return;
    }

    setTransfer(confirmPreviewTransferParticipant(transfer, "seller"));
    setCode(createEmptyCode());
    setErrors({});
  };

  const restartTransfer = () => {
    removePreviewTransfer(vehicle.id);
    setTransfer(null);
    setRecipient("");
    setAccepted(false);
    setCode(createEmptyCode());
    setErrors({});
  };

  return (
    <AppShell>
      <PageTopBar title="Transferir veículo" />

      <main className={styles.transferScreen}>
        <section className={styles.vehicleSummary}>
          <VehicleBrandLogo
            brandId={vehicle.brandId}
            className={styles.brandLogo}
            type={vehicle.type}
          />
          <div>
            <h2>{vehicle.name}</h2>
            <p>{vehicle.version}</p>
          </div>
          <VehiclePlate plate={vehicle.plate} />
        </section>

        {!ready ? (
          <div className={styles.loadingState} role="status">
            <HourglassMedium aria-hidden size={24} weight="duotone" />
            Carregando transferência...
          </div>
        ) : !transfer ? (
          <>
            <header className={styles.intro}>
              <h2>Transferir histórico do veículo</h2>
              <p>Inicie o processo para disponibilizar o histórico ao novo proprietário.</p>
            </header>

            <section className="app-notice app-notice--danger">
              <ShieldWarning aria-hidden size={25} weight="fill" />
              <div>
                <h2>Atenção importante</h2>
                <p>
                  A transferência será concluída somente após a confirmação do comprador e do vendedor.
                  Depois de concluída, ela não poderá ser desfeita.
                </p>
                <p><strong>Nota:</strong> esta operação não substitui a transferência legal junto ao DETRAN.</p>
              </div>
            </section>

            <form className={`app-form-card ${styles.transferForm}`} noValidate onSubmit={startTransfer}>
              <FormField
                autoComplete="email"
                error={errors.recipient}
                Icon={IdentificationCard}
                label="E-mail ou CPF do novo proprietário"
                name="new-owner"
                onChange={(event) => {
                  setRecipient(formatRecipientInput(event.target.value));
                  setErrors((current) => ({ ...current, recipient: "" }));
                }}
                placeholder="E-mail ou 000.000.000-00"
                value={recipient}
              />

              <label className="app-checkbox-field">
                <input
                  checked={accepted}
                  onChange={(event) => {
                    setAccepted(event.target.checked);
                    setErrors((current) => ({ ...current, consent: "" }));
                  }}
                  type="checkbox"
                />
                <span className="app-checkbox-control">
                  <Check aria-hidden size={15} weight="bold" />
                </span>
                <span>
                  Estou ciente de que, após as duas confirmações, o histórico será transferido e o veículo será desvinculado da minha conta.
                </span>
              </label>
              {errors.consent && <p className="app-error-text">{errors.consent}</p>}

              <div className={styles.formActions}>
                <ActionButton type="submit">
                  <ArrowsLeftRight aria-hidden size={20} weight="bold" />
                  Iniciar transferência
                </ActionButton>
                <ActionButton onClick={() => router.back()} type="button" variant="secondary">
                  Cancelar
                </ActionButton>
              </div>
            </form>
          </>
        ) : transfer.status === "expired" ? (
          <section className={`app-card ${styles.expiredState}`}>
            <ClockCountdown aria-hidden size={30} weight="duotone" />
            <h2>Prazo de confirmação encerrado</h2>
            <p>A transferência não foi concluída dentro do prazo previsto.</p>
            <ActionButton onClick={restartTransfer} type="button">
              Iniciar nova transferência
            </ActionButton>
          </section>
        ) : transfer.status === "completed" ? (
          <section className={`app-card ${styles.completedState}`}>
            <CheckCircle aria-hidden size={34} weight="fill" />
            <h2>Transferência concluída</h2>
            <p>Comprador e vendedor confirmaram seus códigos. O histórico foi disponibilizado ao novo proprietário.</p>
            <ActionButton onClick={() => router.push(`/garagem/${vehicle.id}`)} type="button">
              Voltar ao veículo
            </ActionButton>
          </section>
        ) : (
          <>
            <header className={styles.intro}>
              <h2>Transferência em andamento</h2>
              <p>O processo foi iniciado e aguarda a confirmação dos dois participantes.</p>
            </header>

            <section className="app-notice app-notice--info">
              <ClockCountdown aria-hidden size={25} weight="duotone" />
              <div>
                <h2>Códigos de confirmação enviados</h2>
                <p>Comprador e vendedor receberam códigos independentes. Cada pessoa pode confirmar em momentos diferentes.</p>
              </div>
            </section>

            <section className={`app-card ${styles.pendingCard}`}>
              <div className={styles.deadline}>
                <CalendarBlank aria-hidden size={21} weight="duotone" />
                <div>
                  <span>Prazo para as duas confirmações</span>
                  <strong>{formatDeadline(transfer.expiresAt)}</strong>
                </div>
                <em>{TRANSFER_CONFIRMATION_WINDOW_HOURS} horas</em>
              </div>

              <div className="app-process-status">
                <ParticipantStatus
                  confirmed={transfer.sellerStatus === "confirmed"}
                  description="Proprietário atual"
                  label="Vendedor"
                />
                <ParticipantStatus
                  confirmed={transfer.buyerStatus === "confirmed"}
                  description={transfer.recipientDisplay}
                  label="Comprador"
                />
              </div>

              {transfer.sellerStatus !== "confirmed" ? (
                <form className={styles.codeForm} noValidate onSubmit={confirmSellerCode}>
                  <div>
                    <h2>Confirme seu código</h2>
                    <p>Digite o código enviado ao contato do vendedor.</p>
                  </div>
                  <VerificationCodeFields
                    autoFocus={false}
                    code={code}
                    error={errors.code}
                    onChange={(nextCode) => {
                      setCode(nextCode);
                      setErrors((current) => ({ ...current, code: "" }));
                    }}
                  />
                  {errors.code && <p className="app-error-text">{errors.code}</p>}
                  <ActionButton type="submit">Confirmar código</ActionButton>
                </form>
              ) : (
                <p className="app-feedback app-feedback--success" role="status">
                  <CheckCircle aria-hidden size={18} weight="fill" />
                  Seu código foi confirmado. O processo continuará aguardando o comprador.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
