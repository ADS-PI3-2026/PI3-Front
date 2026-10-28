"use client";

import {
  ArrowRight,
  ArrowsLeftRight,
  CaretRight,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  FloppyDisk,
  Gauge,
  IdentificationCard,
  Info,
  ShieldCheck,
  ShieldWarning,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ActionButton from "../../../components/action-button";
import AppShell from "../../../components/app-shell";
import { getAuthErrorMessage } from "../../../auth-api";
import VerificationCodeFields from "../../../components/verification-code-fields";
import VehicleBrandLogo from "../../../components/vehicle-brand-logo";
import VehiclePlate from "../../../components/vehicle-plate";
import {
  createEmptyCode,
  VERIFICATION_CODE_LENGTH,
} from "../../../lib/form-validation";
import {
  convertLegacyPlateToMercosul,
  getVehiclePlateType,
} from "../../../lib/vehicle-plate";
import PageTopBar from "../../_components/page-top-bar";
import {
  changeVehiclePlateType,
  deleteVehicle,
  getVehicle,
  getVehicleErrorMessage,
  getVehicleFieldErrors,
  requestVehiclePlateChangeCode,
  updateVehicle,
  validateVehiclePlateChangeCode,
} from "../../_lib/garage-api";
import { onlyDigits } from "../../_lib/garage-validation";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");

export default function ManageVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const actionPanelRef = useRef(null);
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [retryRevision, setRetryRevision] = useState(0);
  const [requestState, setRequestState] = useState({
    error: "",
    loading: true,
    notFound: false,
    vehicle: null,
  });
  const [activeAction, setActiveAction] = useState("");
  const [panelScrollRevision, setPanelScrollRevision] = useState(0);
  const [actionFeedback, setActionFeedback] = useState({ message: "", type: "" });
  const [mileageError, setMileageError] = useState("");
  const [mileageValue, setMileageValue] = useState("");
  const [updatingMileage, setUpdatingMileage] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteConfirmationError, setDeleteConfirmationError] = useState("");
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [plateCode, setPlateCode] = useState(createEmptyCode);
  const [plateCodeError, setPlateCodeError] = useState("");
  const [platePending, setPlatePending] = useState(false);
  const [plateStep, setPlateStep] = useState("review");

  useEffect(() => {
    let active = true;

    async function loadVehicle() {
      setRequestState((current) => ({
        ...current,
        error: "",
        loading: true,
        notFound: false,
      }));

      try {
        const vehicle = await getVehicle(vehicleId);
        if (active) {
          setRequestState({
            error: "",
            loading: false,
            notFound: false,
            vehicle,
          });
        }
      } catch (error) {
        if (active) {
          setRequestState({
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
    if (!activeAction || !actionPanelRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    actionPanelRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [activeAction, panelScrollRevision]);

  if (requestState.loading) {
    return (
      <AppShell>
        <PageTopBar title="Gerenciar veículo" />
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotch aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
          <p>Carregando veículo...</p>
        </section>
      </AppShell>
    );
  }

  if (!requestState.vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Gerenciar veículo" />
        <section className="app-empty-state app-empty-state--narrow" role="alert">
          <h2>{requestState.notFound ? "Veículo não encontrado" : "Não foi possível carregar o veículo"}</h2>
          <p>
            {requestState.notFound
              ? "Volte para a garagem e selecione um veículo cadastrado."
              : requestState.error}
          </p>
          {requestState.notFound ? (
            <Link className="app-empty-link" href="/garagem">Ir para garagem</Link>
          ) : (
            <button
              className="app-empty-link"
              onClick={() => setRetryRevision((revision) => revision + 1)}
              type="button"
            >
              Tentar novamente
            </button>
          )}
        </section>
      </AppShell>
    );
  }

  const vehicle = requestState.vehicle;

  const originalPlateType = getVehiclePlateType(vehicle.plate);
  const convertedPlate = convertLegacyPlateToMercosul(vehicle.plate);
  const plateAlreadyMercosul = originalPlateType === "mercosul";
  const plateCanBeConverted = Boolean(convertedPlate);

  const openMileageAction = () => {
    setActiveAction("mileage");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setMileageError("");
    setMileageValue(String(vehicle.mileage));
  };

  const openPlateAction = () => {
    setActiveAction("plate");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setPlateCode(createEmptyCode());
    setPlateCodeError("");
    setPlateStep("review");
  };

  const openDeleteAction = () => {
    setActiveAction("delete");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setDeleteConfirmation("");
    setDeleteConfirmationError("");
  };

  const submitMileage = async (event) => {
    event.preventDefault();
    const mileage = Number(mileageValue);

    if (!mileageValue) {
      setMileageError("Informe a quilometragem atual do veículo.");
      return;
    }
    if (!Number.isSafeInteger(mileage) || mileage < vehicle.mileage) {
      setMileageError(
        `Informe uma quilometragem inteira igual ou maior que ${mileageFormatter.format(vehicle.mileage)} km.`,
      );
      return;
    }

    setUpdatingMileage(true);
    setMileageError("");
    setActionFeedback({ message: "", type: "" });
    try {
      const updatedVehicle = await updateVehicle(vehicle.id, { mileage });
      setRequestState((current) => ({ ...current, vehicle: updatedVehicle }));
      setMileageValue(String(updatedVehicle.mileage));
      setActiveAction("");
      setActionFeedback({
        message: `Quilometragem atualizada para ${mileageFormatter.format(updatedVehicle.mileage)} km.`,
        type: "success",
      });
    } catch (error) {
      const fieldErrors = getVehicleFieldErrors(error);
      setMileageError(fieldErrors.mileage ?? "");
      setActionFeedback({
        message: getVehicleErrorMessage(
          error,
          "Não foi possível atualizar a quilometragem. Tente novamente.",
        ),
        type: "error",
      });
    } finally {
      setUpdatingMileage(false);
    }
  };

  const sendPlateChangeCode = async () => {
    if (platePending) return;

    setPlatePending(true);
    setPlateCodeError("");
    setActionFeedback({ message: "", type: "" });
    try {
      await requestVehiclePlateChangeCode();
      setPlateCode(createEmptyCode());
      setPlateStep("code");
    } catch (error) {
      setPlateCodeError(
        getAuthErrorMessage(error, "Não foi possível enviar o código. Tente novamente."),
      );
    } finally {
      setPlatePending(false);
    }
  };

  const confirmPlateChange = async (event) => {
    event.preventDefault();

    if (platePending) return;

    if (plateCode.join("").length !== VERIFICATION_CODE_LENGTH) {
      setPlateCodeError("Digite os seis números enviados para o seu e-mail cadastrado.");
      return;
    }

    let codeValidated = false;
    setPlatePending(true);
    setPlateCodeError("");
    setActionFeedback({ message: "", type: "" });
    try {
      const actionToken = await validateVehiclePlateChangeCode(plateCode.join(""));
      codeValidated = true;
      await changeVehiclePlateType(vehicle.id, actionToken);
      window.location.reload();
    } catch (error) {
      const message = getAuthErrorMessage(
        error,
        codeValidated
          ? "Não foi possível alterar a placa."
          : "O código não pôde ser validado. Tente novamente.",
      );

      if (codeValidated) {
        setPlateCode(createEmptyCode());
        setPlateStep("review");
        setPlateCodeError(`${message} Solicite um novo código para tentar novamente.`);
      } else {
        setPlateCodeError(message);
      }
    } finally {
      setPlatePending(false);
    }
  };

  const submitVehicleDeletion = async (event) => {
    event.preventDefault();
    const normalizedConfirmation = deleteConfirmation.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const normalizedPlate = vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (normalizedConfirmation !== normalizedPlate) {
      setDeleteConfirmationError("Digite a placa completa do veículo para confirmar.");
      return;
    }

    setDeletingVehicle(true);
    setDeleteConfirmationError("");
    setActionFeedback({ message: "", type: "" });
    try {
      await deleteVehicle(vehicle.id);
      router.replace("/garagem");
    } catch (error) {
      setActionFeedback({
        message: getAuthErrorMessage(
          error,
          "Não foi possível remover o veículo. Tente novamente.",
        ),
        type: "error",
      });
    } finally {
      setDeletingVehicle(false);
    }
  };

  return (
    <AppShell>
      <PageTopBar title="Gerenciar veículo" />

      <main className={styles.managementScreen}>
        <section className={styles.vehicleSummary}>
          <VehicleBrandLogo
            brandId={vehicle.brandId}
            className={styles.brandLogo}
            type={vehicle.type}
          />
          <div className={styles.vehicleName}>
            <h2>{vehicle.name}</h2>
            <p>{vehicle.version}</p>
          </div>
          <VehiclePlate plate={vehicle.plate} />
        </section>

        <section aria-labelledby="management-options-title" className={styles.optionsSection}>
          <header className={styles.sectionHeading}>
            <h2 id="management-options-title">Opções do veículo</h2>
            <p>Selecione a operação que deseja realizar.</p>
          </header>

          <div className="app-action-list">
            <button
              aria-expanded={activeAction === "mileage"}
              className={`app-action-item ${activeAction === "mileage" ? "app-action-item--active" : ""}`}
              onClick={openMileageAction}
              type="button"
            >
              <span className="app-action-icon">
                <Gauge aria-hidden size={24} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Atualizar quilometragem</strong>
                <span>Odômetro atual: {mileageFormatter.format(vehicle.mileage)} km.</span>
              </span>
              <CaretRight aria-hidden size={19} weight="bold" />
            </button>

            <Link
              className="app-action-item"
              href={`/garagem/${vehicle.id}/gerenciar/transferencia`}
            >
              <span className="app-action-icon">
                <ArrowsLeftRight aria-hidden size={23} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Transferir veículo</strong>
                <span>Alterar o proprietário responsável pelo veículo.</span>
              </span>
              <CaretRight aria-hidden size={19} weight="bold" />
            </Link>

            <button
              aria-expanded={activeAction === "plate"}
              className={`app-action-item ${activeAction === "plate" ? "app-action-item--active" : ""}`}
              disabled={!plateCanBeConverted}
              onClick={openPlateAction}
              type="button"
            >
              <span className="app-action-icon">
                <IdentificationCard aria-hidden size={24} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Alteração de placa</strong>
                <span>
                  {plateAlreadyMercosul
                    ? "Este veículo já utiliza o padrão Mercosul."
                    : plateCanBeConverted
                      ? "Converter automaticamente a placa antiga para o padrão Mercosul."
                      : "A placa atual não possui um formato compatível com a conversão."}
                </span>
              </span>
              {plateAlreadyMercosul ? (
                <span className="app-action-status">
                  <CheckCircle aria-hidden size={17} weight="fill" />
                  Atualizada
                </span>
              ) : (
                <CaretRight aria-hidden size={19} weight="bold" />
              )}
            </button>

            <button
              aria-expanded={activeAction === "delete"}
              className={`app-action-item ${styles.dangerAction} ${activeAction === "delete" ? "app-action-item--active" : ""}`}
              onClick={openDeleteAction}
              type="button"
            >
              <span className={`app-action-icon ${styles.dangerIcon}`}>
                <Trash aria-hidden size={23} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Remover da garagem</strong>
                <span>Remover o veículo e seu histórico da garagem.</span>
              </span>
              <CaretRight aria-hidden size={19} weight="bold" />
            </button>
          </div>
        </section>

        {activeAction === "mileage" && (
          <section className={`app-card ${styles.actionPanel}`} ref={actionPanelRef}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <Gauge aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Atualizar quilometragem</h2>
                <p>O odômetro não pode ser reduzido depois da atualização.</p>
              </div>
            </div>

            <form className={styles.mileageForm} noValidate onSubmit={submitMileage}>
              <label className="app-field">
                <span>Quilometragem atual (km)</span>
                <span
                  className={`app-control-shell ${styles.mileageInput}`}
                  data-error={Boolean(mileageError)}
                >
                  <Gauge aria-hidden size={20} weight="regular" />
                  <input
                    disabled={updatingMileage}
                    inputMode="numeric"
                    onChange={(event) => {
                      setMileageValue(onlyDigits(event.target.value));
                      setMileageError("");
                      setActionFeedback({ message: "", type: "" });
                    }}
                    value={mileageValue}
                  />
                </span>
                <small>
                  Valor atual: {mileageFormatter.format(vehicle.mileage)} km.
                </small>
                {mileageError && <small className="app-error-text">{mileageError}</small>}
              </label>

              <ActionButton disabled={updatingMileage} type="submit">
                {updatingMileage
                  ? <CircleNotch aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                  : <FloppyDisk aria-hidden size={20} weight="bold" />}
                {updatingMileage ? "Atualizando..." : "Salvar quilometragem"}
              </ActionButton>
            </form>
          </section>
        )}

        {activeAction === "plate" && plateCanBeConverted && (
          <section className={`app-card ${styles.actionPanel}`} ref={actionPanelRef}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <IdentificationCard aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Converter para o padrão Mercosul</h2>
                <p>A nova combinação é calculada automaticamente.</p>
              </div>
            </div>

            <div aria-label="Conversão da placa" className={styles.plateComparison}>
              <div className={styles.plateStage}>
                <span>Placa atual</span>
                <VehiclePlate plate={vehicle.plate} />
              </div>
              <ArrowRight aria-hidden className={styles.conversionArrow} size={24} weight="bold" />
              <div className={styles.plateStage}>
                <span>Nova placa</span>
                <VehiclePlate plate={convertedPlate} />
              </div>
            </div>

            <p className="app-feedback app-feedback--info">
              <Info aria-hidden size={18} weight="fill" />
              Apenas o segundo número do bloco numérico é convertido para a letra oficial correspondente.
            </p>

            {plateStep === "review" ? (
              <div className={styles.confirmationStep}>
                <div className={styles.securityNotice}>
                  <ShieldCheck aria-hidden size={22} weight="duotone" />
                  <div>
                    <strong>Confirmação de segurança</strong>
                    <p>Enviaremos um código OTP para o e-mail cadastrado antes de alterar a placa.</p>
                  </div>
                </div>
                <ActionButton disabled={platePending} onClick={sendPlateChangeCode} type="button">
                  <EnvelopeSimple aria-hidden size={20} weight="bold" />
                  {platePending ? "Enviando código..." : "Enviar código de confirmação"}
                </ActionButton>
                {plateCodeError && <p className="app-error-text" role="alert">{plateCodeError}</p>}
              </div>
            ) : (
              <form className={styles.verificationForm} noValidate onSubmit={confirmPlateChange}>
                <div className={styles.verificationHeading}>
                  <h3>Confirme a alteração</h3>
                  <p>Digite o código de seis dígitos enviado para o seu e-mail cadastrado.</p>
                </div>
                <VerificationCodeFields
                  code={plateCode}
                  error={plateCodeError}
                  onChange={(nextCode) => {
                    setPlateCode(nextCode);
                    setPlateCodeError("");
                  }}
                />
                {plateCodeError && <p className="app-error-text">{plateCodeError}</p>}
                <div className={styles.verificationActions}>
                  <button
                    className={styles.resendButton}
                    disabled={platePending}
                    onClick={sendPlateChangeCode}
                    type="button"
                  >
                    {platePending ? "Reenviando..." : "Reenviar código"}
                  </button>
                  <ActionButton disabled={platePending} type="submit">
                    <ShieldCheck aria-hidden size={20} weight="bold" />
                    {platePending ? "Confirmando..." : "Confirmar e converter placa"}
                  </ActionButton>
                </div>
              </form>
            )}
          </section>
        )}

        {activeAction === "delete" && (
          <section
            className={`app-card ${styles.actionPanel} ${styles.dangerPanel}`}
            ref={actionPanelRef}
          >
            <div className={styles.panelHeading}>
              <span className={`app-action-icon ${styles.dangerIcon}`}>
                <ShieldWarning aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Remover veículo da garagem</h2>
                <p>O veículo será removido da garagem juntamente com todo o seu histórico.</p>
              </div>
            </div>

            <form className={styles.deleteForm} noValidate onSubmit={submitVehicleDeletion}>
              <label className="app-field">
                <span>Digite a placa {vehicle.plate} para confirmar</span>
                <span
                  className={`app-control-shell ${styles.deleteInput}`}
                  data-error={Boolean(deleteConfirmationError)}
                >
                  <input
                    autoComplete="off"
                    disabled={deletingVehicle}
                    maxLength={8}
                    onChange={(event) => {
                      setDeleteConfirmation(event.target.value.toUpperCase());
                      setDeleteConfirmationError("");
                      setActionFeedback({ message: "", type: "" });
                    }}
                    placeholder={vehicle.plate}
                    value={deleteConfirmation}
                  />
                </span>
                {deleteConfirmationError && (
                  <small className="app-error-text">{deleteConfirmationError}</small>
                )}
              </label>

              <ActionButton disabled={deletingVehicle} type="submit" variant="danger">
                {deletingVehicle
                  ? <CircleNotch aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                  : <Trash aria-hidden size={20} weight="bold" />}
                {deletingVehicle ? "Removendo..." : "Remover veículo"}
              </ActionButton>
            </form>
          </section>
        )}

        {actionFeedback.message && (
          <p
            className={`app-feedback app-feedback--${actionFeedback.type || "success"}`}
            role={actionFeedback.type === "error" ? "alert" : "status"}
          >
            {actionFeedback.type === "error"
              ? <WarningCircle aria-hidden size={18} weight="fill" />
              : <CheckCircle aria-hidden size={18} weight="fill" />}
            {actionFeedback.message}
          </p>
        )}
      </main>
    </AppShell>
  );
}
