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
import AppShell from "../../components/app-shell";
import FormField from "../../components/form-field";
import VerificationCodeFields from "../../components/verification-code-fields";
import { getAuthErrorMessage } from "../../auth-api";
import { createEmptyCode, VERIFICATION_CODE_LENGTH } from "../../lib/form-validation";
import ActiveTransferList from "../_components/active-transfer-list";
import PageTopBar from "../_components/page-top-bar";
import TransferCancelControl from "../_components/transfer-cancel-control";
import {
  buildBuyerTransferPayload,
  cancelVehicleTransfer,
  getVehicleTransfer,
  getVehicleTransferErrorMessage,
  getVehicleTransferFieldErrors,
  listVehicleTransferPage,
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
  const [accepted, setAccepted] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [code, setCode] = useState(createEmptyCode);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({ plate: "", renavam: "" });
  const [listActionFeedback, setListActionFeedback] = useState({ error: "", success: "" });
  const [listRevision, setListRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [receivedCodeOpen, setReceivedCodeOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [transferList, setTransferList] = useState({
    error: "",
    hasMore: false,
    items: [],
    loading: true,
    loadingMore: false,
    page: 1,
    total: 0,
  });

  useEffect(() => {
    let active = true;

    async function loadPrefill() {
      await Promise.resolve();
      if (!active) return;
      const prefill = consumeVehicleTransferPrefill();
      if (prefill) setForm(prefill);
      setReady(true);
    }

    void loadPrefill();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTransfers() {
      setTransferList((current) => ({ ...current, error: "", loading: true }));
      try {
        const page = await listVehicleTransferPage(1);
        if (!active) return;
        setTransferList({
          error: "",
          hasMore: page.hasMore,
          items: page.items,
          loading: false,
          loadingMore: false,
          page: page.page,
          total: page.total,
        });
      } catch (error) {
        if (!active) return;
        setTransferList({
          error: getAuthErrorMessage(
            error,
            "Não foi possível carregar suas transferências. Tente novamente.",
          ),
          hasMore: false,
          items: [],
          loading: false,
          loadingMore: false,
          page: 1,
          total: 0,
        });
      }
    }

    void loadTransfers();
    return () => { active = false; };
  }, [listRevision]);

  const clearTransfer = () => {
    setTransfer(null);
    setForm({ plate: "", renavam: "" });
    setAccepted(false);
    setCode(createEmptyCode());
    setErrors({});
    setFeedback("");
    setReceivedCodeOpen(false);
    setListRevision((revision) => revision + 1);
  };

  const loadMoreTransfers = async () => {
    if (transferList.loadingMore || !transferList.hasMore) return;
    setTransferList((current) => ({ ...current, loadingMore: true }));
    try {
      const nextPage = await listVehicleTransferPage(transferList.page + 1);
      setTransferList((current) => {
        const knownIds = new Set(current.items.map((item) => item.id));
        return {
          ...current,
          hasMore: nextPage.hasMore,
          items: [...current.items, ...nextPage.items.filter((item) => !knownIds.has(item.id))],
          loadingMore: false,
          page: nextPage.page,
          total: nextPage.total,
        };
      });
    } catch (error) {
      setTransferList((current) => ({ ...current, loadingMore: false }));
      setListActionFeedback({
        error: getAuthErrorMessage(error, "Não foi possível carregar mais transferências."),
        success: "",
      });
    }
  };

  const cancelTransfer = async (transferToCancel) => {
    if (cancellingId != null) return false;
    setCancellingId(transferToCancel.id);
    setListActionFeedback({ error: "", success: "" });
    try {
      await cancelVehicleTransfer(transferToCancel.id);
      if (transfer?.id === transferToCancel.id) setTransfer(null);
      setListActionFeedback({ error: "", success: "Transferência cancelada com sucesso." });
      setListRevision((revision) => revision + 1);
      return true;
    } catch (error) {
      const message = getAuthErrorMessage(error, "Não foi possível cancelar a transferência.");
      setListActionFeedback({
        error: message,
        success: "",
      });
      if (transfer?.id === transferToCancel.id) setFeedback(message);
      return false;
    } finally {
      setCancellingId(null);
    }
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

      const loadedTransfer = await getVehicleTransfer(confirmation.id);
      const updatedTransfer = {
        ...loadedTransfer,
        ownerValidated: confirmation.ownerValidated,
        recipientValidated: confirmation.recipientValidated,
        status: confirmation.status,
      };
      setTransfer(updatedTransfer);
      setCode(createEmptyCode());
      setListRevision((revision) => revision + 1);
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
      setTransfer({
        ...startedTransfer,
        requestedPlate: form.plate,
      });
      setCode(createEmptyCode());
      setListRevision((revision) => revision + 1);
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
      setListRevision((revision) => revision + 1);
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
      setListRevision((revision) => revision + 1);
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
        <PageTopBar title="Transferências" />
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
      <PageTopBar title="Transferências" />

      <main className={styles.transferScreen}>
        {!transfer ? (
          <>
            {listActionFeedback.success && (
              <p className="app-feedback app-feedback--success" role="status">
                <CheckCircle aria-hidden size={18} weight="fill" />
                {listActionFeedback.success}
              </p>
            )}
            {listActionFeedback.error && (
              <p className="app-feedback app-feedback--error" role="alert">
                <WarningCircle aria-hidden size={18} weight="fill" />
                {listActionFeedback.error}
              </p>
            )}

            <ActiveTransferList
              cancellingId={cancellingId}
              error={transferList.error}
              hasMore={transferList.hasMore}
              items={transferList.items}
              loading={transferList.loading}
              loadingMore={transferList.loadingMore}
              onCancel={cancelTransfer}
              onLoadMore={() => void loadMoreTransfers()}
              onRetry={() => setListRevision((revision) => revision + 1)}
              onSelect={(selectedTransfer) => {
                setTransfer(selectedTransfer);
                setCode(createEmptyCode());
                setErrors({});
                setFeedback("");
                setListActionFeedback({ error: "", success: "" });
              }}
              total={transferList.total}
            />

            <div className={styles.optionDivider}><span>ou inicie uma solicitação</span></div>

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

              <TransferCancelControl
                disabled={pending || cancellingId === transfer.id}
                onConfirm={() => cancelTransfer(transfer)}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}
