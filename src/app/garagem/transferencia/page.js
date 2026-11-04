"use client";

import {
  ArrowsLeftRight,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  HashStraight,
  IdentificationCard,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import ActionButton from "../../components/action-button";
import AppShell, { useAuthUser } from "../../components/app-shell";
import FormField from "../../components/form-field";
import VerificationCodeFields from "../../components/verification-code-fields";
import { getAuthErrorMessage } from "../../auth-api";
import { createEmptyCode, VERIFICATION_CODE_LENGTH } from "../../lib/form-validation";
import PageTopBar from "../_components/page-top-bar";
import {
  buildBuyerTransferPayload,
  getVehicleTransfer,
  getVehicleTransferErrorMessage,
  getVehicleTransferFieldErrors,
  startVehicleTransferByBuyer,
  validateVehicleTransferCode,
} from "../_lib/garage-api";
import {
  formatPlateInput,
  onlyDigits,
  validateBuyerTransferForm,
} from "../_lib/garage-validation";
import { consumeVehicleTransferPrefill } from "../_lib/vehicle-transfer-prefill";
import styles from "./page.module.css";

function getStorageKey(userId) {
  return "legado-car-buyer-transfer-" + userId;
}

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ParticipantStatus({ confirmed, label }) {
  return (
    <div className={styles.participant}>
      <span className={confirmed ? styles.confirmedIcon : styles.pendingIcon}>
        {confirmed
          ? <CheckCircle aria-hidden size={21} weight="fill" />
          : <ClockCountdown aria-hidden size={21} weight="duotone" />}
      </span>
      <strong>{label}</strong>
      <span>{confirmed ? "Confirmado" : "Aguardando"}</span>
    </div>
  );
}

export default function BuyerTransferPage() {
  return <AppShell><BuyerTransferContent /></AppShell>;
}

function BuyerTransferContent() {
  const user = useAuthUser();
  const storageKey = getStorageKey(user.id);
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState(createEmptyCode);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({ plate: "", renavam: "" });
  const [pending, setPending] = useState(false);
  const [receivedCodeOpen, setReceivedCodeOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [transfer, setTransfer] = useState(null);

  useEffect(() => {
    let active = true;

    async function restoreTransfer() {
      const storedId = window.localStorage.getItem(storageKey);
      const prefill = consumeVehicleTransferPrefill();
      if (!storedId) {
        if (active) {
          if (prefill) setForm(prefill);
          setReady(true);
        }
        return;
      }

      try {
        const loadedTransfer = await getVehicleTransfer(storedId);
        if (active) setTransfer(loadedTransfer);
      } catch (error) {
        if (error?.status === 404) {
          window.localStorage.removeItem(storageKey);
        } else if (active) {
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
  }, [storageKey]);

  const clearTransfer = () => {
    window.localStorage.removeItem(storageKey);
    setTransfer(null);
    setForm({ plate: "", renavam: "" });
    setAccepted(false);
    setCode(createEmptyCode());
    setErrors({});
    setFeedback("");
    setReceivedCodeOpen(false);
  };

  const confirmReceivedTransfer = async (event) => {
    event.preventDefault();
    if (pending) return;

    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setErrors({ code: "Digite os seis números fornecidos pelo proprietário atual." });
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback("");
    let confirmedTransferId = null;

    try {
      const confirmation = await validateVehicleTransferCode(code.join(""));
      confirmedTransferId = confirmation.id;
      window.localStorage.setItem(storageKey, String(confirmation.id));

      const loadedTransfer = await getVehicleTransfer(confirmation.id);
      const updatedTransfer = {
        ...loadedTransfer,
        ownerValidated: confirmation.ownerValidated,
        recipientValidated: confirmation.recipientValidated,
        status: confirmation.status,
      };
      setTransfer(updatedTransfer);
      setCode(createEmptyCode());
      if (updatedTransfer.status === "completed") {
        window.localStorage.removeItem(storageKey);
      }
    } catch (error) {
      if (confirmedTransferId) {
        setFeedback("Sua confirmação foi recebida, mas não foi possível carregar o andamento. Atualize a página.");
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

    const validationErrors = validateBuyerTransferForm(form);
    if (!accepted) {
      validationErrors.consent = "Confirme que deseja solicitar a transferência deste veículo.";
    }
    setErrors(validationErrors);
    setFeedback("");
    if (Object.keys(validationErrors).length > 0) return;

    setPending(true);
    try {
      const startedTransfer = await startVehicleTransferByBuyer(
        buildBuyerTransferPayload(form),
      );
      window.localStorage.setItem(storageKey, String(startedTransfer.id));
      setTransfer({
        ...startedTransfer,
        requestedPlate: form.plate,
      });
      setCode(createEmptyCode());
    } catch (error) {
      setErrors(getVehicleTransferFieldErrors(error));
      setFeedback(
        error?.status === 404
          ? "Não encontramos um veículo com os dados informados."
          : getVehicleTransferErrorMessage(
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
      setTransfer(refreshedTransfer);
      if (refreshedTransfer.status === "completed") {
        window.localStorage.removeItem(storageKey);
      }
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

  const confirmBuyerCode = async (event) => {
    event.preventDefault();
    if (pending || !transfer) return;

    if (code.join("").length !== VERIFICATION_CODE_LENGTH) {
      setErrors({ code: "Digite os seis números fornecidos pelo proprietário atual." });
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
      if (updatedTransfer.status === "completed") {
        window.localStorage.removeItem(storageKey);
      }
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

  if (!ready) {
    return (
      <>
        <PageTopBar title="Solicitar transferência" />
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
          <p>Carregando transferência...</p>
        </section>
      </>
    );
  }

  const terminalStatus = ["cancelled", "expired"].includes(transfer?.status);
  const vehiclePlate = transfer?.vehicle?.plate || transfer?.requestedPlate || "";

  return (
    <>
      <PageTopBar title="Solicitar transferência" />

      <main className={styles.transferScreen}>
        {!transfer ? (
          <>
            <header className={styles.intro}>
              <span className={styles.introIcon}>
                <ArrowsLeftRight aria-hidden size={28} weight="duotone" />
              </span>
              <div>
                <h2>Trazer um veículo para sua garagem</h2>
                <p>Use os dados do veículo que já possui cadastro no LegadoCar.</p>
              </div>
            </header>

            <section className="app-notice app-notice--info">
              <ShieldCheck aria-hidden size={24} weight="duotone" />
              <div>
                <h2>Confirmação entre os proprietários</h2>
                <p>O proprietário atual será avisado e a transferência só terminará após as duas confirmações.</p>
                <p>Este processo não substitui a transferência legal junto ao DETRAN.</p>
              </div>
            </section>

            <section className={`app-card ${styles.receivedTransferCard}`}>
              <div className={styles.receivedTransferHeader}>
                <div>
                  <h2>O proprietário iniciou a transferência?</h2>
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
                <form className={styles.receivedCodeForm} noValidate onSubmit={confirmReceivedTransfer}>
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
                  {feedback && (
                    <p className="app-feedback app-feedback--error" role="alert">
                      <WarningCircle aria-hidden size={18} weight="fill" />
                      {feedback}
                    </p>
                  )}
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

            <div className={styles.optionDivider}><span>ou solicite pelo veículo</span></div>

            <form className={"app-form-card " + styles.transferForm} noValidate onSubmit={startTransfer}>
              <FormField
                autoComplete="off"
                error={errors.plate}
                Icon={IdentificationCard}
                label="Placa do veículo"
                maxLength={8}
                name="plate"
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    plate: formatPlateInput(event.target.value),
                  }));
                  setErrors((current) => ({ ...current, plate: "" }));
                  setFeedback("");
                }}
                placeholder="ABC1D23 ou ABC-1234"
                value={form.plate}
              />

              <FormField
                autoComplete="off"
                error={errors.renavam}
                Icon={HashStraight}
                inputMode="numeric"
                label="RENAVAM"
                maxLength={11}
                name="renavam"
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    renavam: onlyDigits(event.target.value).slice(0, 11),
                  }));
                  setErrors((current) => ({ ...current, renavam: "" }));
                  setFeedback("");
                }}
                placeholder="9 ou 11 dígitos"
                value={form.renavam}
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
                <span>Confirmo que desejo solicitar a transferência deste veículo para minha garagem.</span>
              </label>
              {errors.consent && <p className="app-error-text">{errors.consent}</p>}

              {feedback && !receivedCodeOpen && (
                <p className="app-feedback app-feedback--error" role="alert">
                  <WarningCircle aria-hidden size={18} weight="fill" />
                  {feedback}
                </p>
              )}

              <ActionButton disabled={pending} type="submit">
                {pending
                  ? <CircleNotch aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                  : <ArrowsLeftRight aria-hidden size={20} weight="bold" />}
                {pending ? "Enviando solicitação..." : "Solicitar transferência"}
              </ActionButton>
            </form>
          </>
        ) : transfer.status === "completed" ? (
          <section className={"app-card " + styles.resultState}>
            <CheckCircle aria-hidden size={38} weight="fill" />
            <h2>Transferência concluída</h2>
            <p>O veículo já foi vinculado à sua garagem.</p>
            <ActionButton onClick={clearTransfer} type="button">Voltar às solicitações</ActionButton>
          </section>
        ) : terminalStatus ? (
          <section className={"app-card " + styles.resultState + " " + styles.expiredState}>
            <ClockCountdown aria-hidden size={38} weight="duotone" />
            <h2>Transferência encerrada</h2>
            <p>Esta solicitação não está mais disponível para confirmação.</p>
            <ActionButton onClick={clearTransfer} type="button">Fazer nova solicitação</ActionButton>
          </section>
        ) : (
          <>
            <header className={styles.intro}>
              <span className={styles.introIcon}>
                <ArrowsLeftRight aria-hidden size={28} weight="duotone" />
              </span>
              <div>
                <h2>Transferência em andamento</h2>
                <p>
                  {transfer.vehicle?.model || "Veículo solicitado"}
                  {vehiclePlate ? " · " + vehiclePlate : ""}
                </p>
              </div>
            </header>

            <section className={"app-card " + styles.pendingCard}>
              <div className={styles.deadline}>
                <CalendarBlank aria-hidden size={21} weight="duotone" />
                <div>
                  <span>Prazo para confirmação</span>
                  <strong>{formatDeadline(transfer.expiresAt)}</strong>
                </div>
              </div>

              <div className={styles.participants}>
                <ParticipantStatus
                  confirmed={transfer.ownerValidated}
                  label="Proprietário atual"
                />
                <ParticipantStatus
                  confirmed={transfer.recipientValidated}
                  label="Sua confirmação"
                />
              </div>

              {!transfer.recipientValidated ? (
                <form className={styles.codeForm} noValidate onSubmit={confirmBuyerCode}>
                  <div>
                    <h2>Confirme sua participação</h2>
                    <p>Digite o código fornecido pelo proprietário atual.</p>
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
                  Sua participação foi confirmada. Agora aguardamos o proprietário atual.
                </p>
              )}

              {feedback && (
                <p className="app-feedback app-feedback--error" role="alert">
                  <WarningCircle aria-hidden size={18} weight="fill" />
                  {feedback}
                </p>
              )}

              <ActionButton
                disabled={pending}
                onClick={() => void refreshTransfer()}
                type="button"
                variant="secondary"
              >
                {pending ? "Atualizando..." : "Atualizar andamento"}
              </ActionButton>
            </section>
          </>
        )}
      </main>
    </>
  );
}
