"use client";

import {
  ArrowsLeftRight,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  IdentificationCard,
  ShieldWarning,
} from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "../../../../components/action-button";
import AppShell, { useAuthUser } from "../../../../components/app-shell";
import FormField from "../../../../components/form-field";
import VehicleBrandLogo from "../../../../components/vehicle-brand-logo";
import VehiclePlate from "../../../../components/vehicle-plate";
import VerificationCodeFields from "../../../../components/verification-code-fields";
import { getAuthErrorMessage } from "../../../../auth-api";
import {
  createEmptyCode,
  isValidEmail,
  VERIFICATION_CODE_LENGTH,
} from "../../../../lib/form-validation";
import PageTopBar from "../../../_components/page-top-bar";
import TransferCancelControl from "../../../_components/transfer-cancel-control";
import {
  cancelVehicleTransfer,
  getVehicle,
  getVehicleTransfer,
  getVehicleTransferErrorMessage,
  getVehicleTransferFieldErrors,
  listVehicleTransferPage,
  startVehicleTransferByOwner,
  validateVehicleTransferCode,
} from "../../../_lib/garage-api";
import styles from "./page.module.css";

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ParticipantStatus({ confirmed, description, label }) {
  return (
    <div className="app-process-status-row">
      <span className="app-action-icon">
        {confirmed
          ? <CheckCircle aria-hidden size={22} weight="fill" />
          : <ClockCountdown aria-hidden size={22} weight="duotone" />}
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
  return (
    <AppShell>
      <VehicleTransferContent />
    </AppShell>
  );
}

function VehicleTransferContent() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthUser();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [retryRevision, setRetryRevision] = useState(0);
  const [vehicleState, setVehicleState] = useState({
    error: "",
    loading: true,
    notFound: false,
    vehicle: null,
  });
  const [recipient, setRecipient] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [transfer, setTransfer] = useState(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState("");
  const [receivedCodeOpen, setReceivedCodeOpen] = useState(false);
  const [code, setCode] = useState(createEmptyCode);

  useEffect(() => {
    let active = true;

    async function loadVehicle() {
      setVehicleState((current) => ({
        ...current,
        error: "",
        loading: true,
        notFound: false,
      }));

      try {
        const vehicle = await getVehicle(vehicleId);
        if (active) {
          setVehicleState({
            error: "",
            loading: false,
            notFound: false,
            vehicle,
          });
        }
      } catch (error) {
        if (active) {
          setVehicleState({
            error: getAuthErrorMessage(
              error,
              "Não foi possível carregar o veículo. Tente novamente.",
            ),
            loading: false,
            notFound: error?.status === 404,
            vehicle: null,
          });
        }
      }
    }

    void loadVehicle();
    return () => { active = false; };
  }, [retryRevision, vehicleId]);

  useEffect(() => {
    let active = true;

    async function restoreTransfer() {
      try {
        const page = await listVehicleTransferPage(1, { vehicleId });
        if (active) setTransfer(page.items.find((item) => item.role === "owner") ?? null);
      } catch (error) {
        if (active) {
          setFeedback(
            getAuthErrorMessage(
              error,
              "Não foi possível recuperar a transferência. Tente novamente.",
            ),
          );
        }
      } finally {
        if (active) setReady(true);
      }
    }

    void restoreTransfer();
    return () => { active = false; };
  }, [vehicleId]);

  const clearTransfer = () => {
    setTransfer(null);
    setRecipient("");
    setAccepted(false);
    setCode(createEmptyCode());
    setErrors({});
    setFeedback("");
    setSuccessFeedback("");
    setReceivedCodeOpen(false);
  };

  const confirmBuyerRequest = async (event) => {
    event.preventDefault();
    if (pending) return;

    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setErrors({ code: "Digite os seis números recebidos pelo novo proprietário." });
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback("");
    let confirmedTransferId = null;

    try {
      const confirmation = await validateVehicleTransferCode(code.join(""));
      confirmedTransferId = confirmation.id;

      const loadedTransfer = await getVehicleTransfer(confirmation.id);
      if (loadedTransfer.vehicleId !== Number(vehicleId)) {
        throw new Error("A solicitação confirmada não corresponde a este veículo.");
      }

      const updatedTransfer = {
        ...loadedTransfer,
        ownerValidated: confirmation.ownerValidated,
        recipientValidated: confirmation.recipientValidated,
        status: confirmation.status,
      };
      setTransfer(updatedTransfer);
      setCode(createEmptyCode());
    } catch (error) {
      if (confirmedTransferId) {
        setFeedback(
          error?.message === "A solicitação confirmada não corresponde a este veículo."
            ? error.message
            : "Sua confirmação foi recebida, mas não foi possível carregar o andamento. Atualize a página.",
        );
      } else {
        setErrors({
          code: getVehicleTransferFieldErrors(error).code
            ?? getVehicleTransferErrorMessage(
              error,
              "O código não pôde ser validado. Tente novamente.",
            ),
        });
      }
    } finally {
      setPending(false);
    }
  };

  const startTransfer = async (event) => {
    event.preventDefault();
    if (pending) return;

    const normalizedRecipient = recipient.trim().toLowerCase();
    const nextErrors = {};
    if (!normalizedRecipient) {
      nextErrors.recipient = "Informe o e-mail do novo proprietário.";
    } else if (!isValidEmail(normalizedRecipient)) {
      nextErrors.recipient = "Digite um endereço de e-mail válido.";
    } else if (normalizedRecipient === String(user.email ?? "").trim().toLowerCase()) {
      nextErrors.recipient = "Informe o e-mail de outra pessoa.";
    }
    if (!accepted) {
      nextErrors.consent = "Confirme que está ciente das condições da transferência.";
    }

    setErrors(nextErrors);
    setFeedback("");
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      const startedTransfer = await startVehicleTransferByOwner(
        vehicleId,
        normalizedRecipient,
      );
      setTransfer(startedTransfer);
      setCode(createEmptyCode());
    } catch (error) {
      setErrors(getVehicleTransferFieldErrors(error));
      setFeedback(
        getVehicleTransferErrorMessage(
          error,
          "Não foi possível iniciar a transferência. Tente novamente.",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const refreshTransfer = async () => {
    if (!transfer || pending) return;
    setPending(true);
    setFeedback("");
    try {
      const refreshedTransfer = await getVehicleTransfer(transfer.id);
      if (refreshedTransfer.vehicleId !== Number(vehicleId)) {
        throw new Error("A transferência não corresponde a este veículo.");
      }
      setTransfer(refreshedTransfer);
    } catch (error) {
      setFeedback(
        getAuthErrorMessage(
          error,
          "Não foi possível atualizar o andamento. Tente novamente.",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  const confirmOwnerCode = async (event) => {
    event.preventDefault();
    if (!transfer || pending) return;

    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setErrors({ code: "Digite os seis números recebidos pelo novo proprietário." });
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback("");
    try {
      const confirmation = await validateVehicleTransferCode(code.join(""));
      if (confirmation.id !== transfer.id) {
        throw new Error("A confirmação não corresponde a esta transferência. Atualize o andamento.");
      }
      const updatedTransfer = {
        ...transfer,
        ownerValidated: confirmation.ownerValidated,
        recipientValidated: confirmation.recipientValidated,
        status: confirmation.status,
      };
      setTransfer(updatedTransfer);
      setCode(createEmptyCode());
    } catch (error) {
      setErrors({
        code: getVehicleTransferFieldErrors(error).code
          ?? getVehicleTransferErrorMessage(
            error,
            "O código não pôde ser validado. Tente novamente.",
          ),
      });
    } finally {
      setPending(false);
    }
  };

  const cancelTransfer = async () => {
    if (!transfer || pending) return false;
    setPending(true);
    setFeedback("");
    setSuccessFeedback("");
    try {
      await cancelVehicleTransfer(transfer.id);
      setTransfer(null);
      setRecipient("");
      setAccepted(false);
      setCode(createEmptyCode());
      setErrors({});
      setReceivedCodeOpen(false);
      setSuccessFeedback("Transferência cancelada com sucesso.");
      return true;
    } catch (error) {
      setFeedback(
        getAuthErrorMessage(error, "Não foi possível cancelar a transferência."),
      );
      return false;
    } finally {
      setPending(false);
    }
  };

  if (vehicleState.loading) {
    return (
      <>
        <PageTopBar title="Transferir veículo" />
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
          <p>Carregando veículo...</p>
        </section>
      </>
    );
  }

  if (!vehicleState.vehicle) {
    return (
      <>
        <PageTopBar title="Transferir veículo" />
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>
            {vehicleState.notFound
              ? "Veículo não encontrado"
              : "Não foi possível carregar o veículo"}
          </h2>
          <p>
            {vehicleState.notFound
              ? "Volte para a garagem e selecione um veículo cadastrado."
              : vehicleState.error}
          </p>
          <button
            className="app-empty-link"
            onClick={() => {
              if (vehicleState.notFound) router.replace("/garagem");
              else setRetryRevision((revision) => revision + 1);
            }}
            type="button"
          >
            {vehicleState.notFound ? "Ir para garagem" : "Tentar novamente"}
          </button>
        </section>
      </>
    );
  }

  const vehicle = vehicleState.vehicle;
  const terminalStatus = ["cancelled", "expired"].includes(transfer?.status);

  return (
    <>
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

        {feedback && (
          <p className="app-feedback app-feedback--error" role="alert">{feedback}</p>
        )}
        {successFeedback && (
          <p className="app-feedback app-feedback--success" role="status">
            <CheckCircle aria-hidden size={18} weight="fill" />
            {successFeedback}
          </p>
        )}

        {!ready ? (
          <div className={styles.loadingState} role="status">
            <CircleNotch aria-hidden className={styles.loadingIcon} size={24} weight="bold" />
            Carregando transferência...
          </div>
        ) : !transfer ? (
          <>
            <header className={styles.intro}>
              <h2>Transferir histórico do veículo</h2>
              <p>Informe quem receberá o veículo e o histórico registrado no LegadoCar.</p>
            </header>

            <section className="app-notice app-notice--danger">
              <ShieldWarning aria-hidden size={25} weight="fill" />
              <div>
                <h2>Atenção importante</h2>
                <p>A transferência será concluída somente após a confirmação das duas pessoas.</p>
                <p>Esta operação não substitui a transferência legal junto ao DETRAN.</p>
              </div>
            </section>

            <section className={`app-card ${styles.receivedTransferCard}`}>
              <div className={styles.receivedTransferHeader}>
                <div>
                  <h2>O comprador solicitou a transferência?</h2>
                  <p>Confirme aqui usando o código que ele recebeu e forneceu a você.</p>
                </div>
                {!receivedCodeOpen && (
                  <ActionButton
                    onClick={() => {
                      setReceivedCodeOpen(true);
                      setCode(createEmptyCode());
                      setErrors({});
                      setFeedback("");
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Informar código
                  </ActionButton>
                )}
              </div>

              {receivedCodeOpen && (
                <form className={styles.receivedCodeForm} noValidate onSubmit={confirmBuyerRequest}>
                  <VerificationCodeFields
                    autoFocus={false}
                    code={code}
                    error={errors.code}
                    onChange={(nextCode) => {
                      setCode(nextCode);
                      setErrors((current) => ({ ...current, code: "" }));
                      setFeedback("");
                    }}
                  />
                  {errors.code && <p className="app-error-text">{errors.code}</p>}
                  <div className={styles.receivedTransferActions}>
                    <ActionButton disabled={pending} type="submit">
                      {pending ? "Confirmando..." : "Confirmar transferência"}
                    </ActionButton>
                    <ActionButton
                      disabled={pending}
                      onClick={() => {
                        setReceivedCodeOpen(false);
                        setCode(createEmptyCode());
                        setErrors({});
                        setFeedback("");
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Voltar
                    </ActionButton>
                  </div>
                </form>
              )}
            </section>

            <div className={styles.optionDivider}><span>ou inicie a transferência</span></div>

            <form className={`app-form-card ${styles.transferForm}`} noValidate onSubmit={startTransfer}>
              <FormField
                autoComplete="email"
                error={errors.recipient}
                Icon={IdentificationCard}
                label="E-mail do novo proprietário"
                name="new-owner"
                onChange={(event) => {
                  setRecipient(event.target.value.slice(0, 255));
                  setErrors((current) => ({ ...current, recipient: "" }));
                  setFeedback("");
                }}
                placeholder="nome@exemplo.com"
                type="email"
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
                  Estou ciente de que, após as duas confirmações, o veículo e seu histórico serão transferidos para a outra pessoa.
                </span>
              </label>
              {errors.consent && <p className="app-error-text">{errors.consent}</p>}

              <div className={styles.formActions}>
                <ActionButton disabled={pending} type="submit">
                  {pending
                    ? <CircleNotch aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                    : <ArrowsLeftRight aria-hidden size={20} weight="bold" />}
                  {pending ? "Iniciando..." : "Iniciar transferência"}
                </ActionButton>
                <ActionButton disabled={pending} onClick={() => router.back()} type="button" variant="secondary">
                  Cancelar
                </ActionButton>
              </div>
            </form>
          </>
        ) : terminalStatus ? (
          <section className={`app-card ${styles.expiredState}`}>
            <ClockCountdown aria-hidden size={30} weight="duotone" />
            <h2>Transferência encerrada</h2>
            <p>Essa solicitação expirou ou foi cancelada antes das duas confirmações.</p>
            <ActionButton onClick={clearTransfer} type="button">
              Iniciar nova transferência
            </ActionButton>
          </section>
        ) : transfer.status === "completed" ? (
          <section className={`app-card ${styles.completedState}`}>
            <CheckCircle aria-hidden size={34} weight="fill" />
            <h2>Transferência concluída</h2>
            <p>As duas confirmações foram realizadas e o veículo foi transferido.</p>
            <ActionButton onClick={() => router.replace("/garagem")} type="button">
              Voltar para a garagem
            </ActionButton>
          </section>
        ) : (
          <>
            <header className={styles.intro}>
              <h2>Transferência em andamento</h2>
              <p>O processo aguarda a confirmação do proprietário atual e do novo proprietário.</p>
            </header>

            <section className="app-notice app-notice--info">
              <ClockCountdown aria-hidden size={25} weight="duotone" />
              <div>
                <h2>Troque os códigos com o novo proprietário</h2>
                <p>Envie a ele o código recebido no seu e-mail e peça o código que foi enviado ao e-mail dele.</p>
              </div>
            </section>

            <section className={`app-card ${styles.pendingCard}`}>
              <div className={styles.deadline}>
                <CalendarBlank aria-hidden size={21} weight="duotone" />
                <div>
                  <span>Prazo para as duas confirmações</span>
                  <strong>{formatDeadline(transfer.expiresAt)}</strong>
                </div>
              </div>

              <div className="app-process-status">
                <ParticipantStatus
                  confirmed={transfer.ownerValidated}
                  description="Proprietário atual"
                  label="Sua confirmação"
                />
                <ParticipantStatus
                  confirmed={transfer.recipientValidated}
                  description="Novo proprietário"
                  label="Outra confirmação"
                />
              </div>

              {!transfer.ownerValidated ? (
                <form className={styles.codeForm} noValidate onSubmit={confirmOwnerCode}>
                  <div>
                    <h2>Código recebido pelo novo proprietário</h2>
                    <p>Digite o código que a outra pessoa recebeu por e-mail e forneceu a você.</p>
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
                  <ActionButton disabled={pending} type="submit">
                    {pending ? "Confirmando..." : "Confirmar código"}
                  </ActionButton>
                </form>
              ) : (
                <p className="app-feedback app-feedback--success" role="status">
                  <CheckCircle aria-hidden size={18} weight="fill" />
                  Sua confirmação foi realizada. Agora falta a confirmação da outra pessoa.
                </p>
              )}

              <ActionButton disabled={pending} onClick={refreshTransfer} type="button" variant="secondary">
                {pending ? "Atualizando..." : "Atualizar andamento"}
              </ActionButton>

              <TransferCancelControl
                disabled={pending}
                onConfirm={cancelTransfer}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
