"use client";

import {
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  FloppyDiskIcon,
  GaugeIcon,
  IdentificationCardIcon,
  InfoIcon,
  PaletteIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
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
  clearPendingOtpRequest,
  readPendingOtpRequest,
  savePendingOtpRequest,
} from "../../../lib/otp-request-state";
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
  requestVehicleDeletionCode,
  updateVehicle,
  validateVehicleDeletionCode,
  validateVehiclePlateChangeCode,
} from "../../_lib/garage-api";
import { onlyDigits } from "../../_lib/garage-validation";
import styles from "./page.module.css";

const mileageFormatter = new Intl.NumberFormat("pt-BR");
const PLATE_OTP_PURPOSE = "change_plate_type";
const VEHICLE_DELETION_OTP_PURPOSE = "vehicle_deletion";

export default function ManageVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const actionPanelRef = useRef(null);
  const restoredOtpVehicleRef = useRef("");
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
  const [colorError, setColorError] = useState("");
  const [colorValue, setColorValue] = useState("");
  const [updatingColor, setUpdatingColor] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteConfirmationError, setDeleteConfirmationError] = useState("");
  const [deleteCode, setDeleteCode] = useState(createEmptyCode);
  const [deleteCodeError, setDeleteCodeError] = useState("");
  const [deleteStep, setDeleteStep] = useState("confirmation");
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

  useEffect(() => {
    if (requestState.loading || !requestState.vehicle
      || restoredOtpVehicleRef.current === vehicleId) return;

    restoredOtpVehicleRef.current = vehicleId;
    const plateRequest = readPendingOtpRequest(PLATE_OTP_PURPOSE, vehicleId);
    const deletionRequest = readPendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);
    const latestRequest = [plateRequest, deletionRequest]
      .filter(Boolean)
      .sort((first, second) => second.requestedAt - first.requestedAt)[0];

    if (!latestRequest) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (latestRequest.purpose === PLATE_OTP_PURPOSE) {
        setActiveAction("plate");
        setPlateStep("code");
        setPlateCode(createEmptyCode());
        setPlateCodeError("");
      } else {
        setActiveAction("delete");
        setDeleteStep("code");
        setDeleteCode(createEmptyCode());
        setDeleteCodeError("");
      }
      setPanelScrollRevision((revision) => revision + 1);
    });
    return () => { active = false; };
  }, [requestState.loading, requestState.vehicle, vehicleId]);

  if (requestState.loading) {
    return (
      <AppShell>
        <PageTopBar title="Gerenciar veículo" />
        <section className="app-empty-state app-empty-state--narrow" role="status">
          <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={25} weight="bold" />
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

  const openColorAction = () => {
    setActiveAction("color");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setColorError("");
    setColorValue(vehicle.color);
  };

  const openPlateAction = () => {
    const pendingRequest = readPendingOtpRequest(PLATE_OTP_PURPOSE, vehicleId);
    setActiveAction("plate");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setPlateCode(createEmptyCode());
    setPlateCodeError("");
    setPlateStep(pendingRequest ? "code" : "review");
  };

  const openDeleteAction = () => {
    const pendingRequest = readPendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);
    setActiveAction("delete");
    setPanelScrollRevision((revision) => revision + 1);
    setActionFeedback({ message: "", type: "" });
    setDeleteConfirmation("");
    setDeleteConfirmationError("");
    setDeleteCode(createEmptyCode());
    setDeleteCodeError("");
    setDeleteStep(pendingRequest ? "code" : "confirmation");
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

  const submitColor = async (event) => {
    event.preventDefault();
    const color = colorValue.trim();

    if (!color) {
      setColorError("Informe a cor do veículo.");
      return;
    }

    setUpdatingColor(true);
    setColorError("");
    setActionFeedback({ message: "", type: "" });
    try {
      const updatedVehicle = await updateVehicle(vehicle.id, {
        color,
        mileage: vehicle.mileage,
      });
      setRequestState((current) => ({ ...current, vehicle: updatedVehicle }));
      setColorValue(updatedVehicle.color);
      setActiveAction("");
      setActionFeedback({
        message: `Cor atualizada para ${updatedVehicle.color}.`,
        type: "success",
      });
    } catch (error) {
      const fieldErrors = getVehicleFieldErrors(error);
      setColorError(fieldErrors.color ?? "");
      setActionFeedback({
        message: getVehicleErrorMessage(
          error,
          "Não foi possível atualizar a cor. Tente novamente.",
        ),
        type: "error",
      });
    } finally {
      setUpdatingColor(false);
    }
  };

  const sendPlateChangeCode = async () => {
    if (platePending) return;

    setPlatePending(true);
    setPlateCodeError("");
    setActionFeedback({ message: "", type: "" });
    try {
      await requestVehiclePlateChangeCode();
      savePendingOtpRequest(PLATE_OTP_PURPOSE, vehicleId);
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

  const cancelPlateConfirmation = () => {
    clearPendingOtpRequest(PLATE_OTP_PURPOSE, vehicleId);
    setPlateCode(createEmptyCode());
    setPlateCodeError("");
    setPlateStep("review");
    setActionFeedback({ message: "", type: "" });
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
      clearPendingOtpRequest(PLATE_OTP_PURPOSE, vehicleId);
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

  const sendDeletionCode = async () => {
    if (deletingVehicle) return;

    const normalizedConfirmation = deleteConfirmation.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const normalizedPlate = vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const pendingRequest = readPendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);

    if (!pendingRequest && normalizedConfirmation !== normalizedPlate) {
      setDeleteConfirmationError("Digite a placa completa do veículo para confirmar.");
      return;
    }

    setDeletingVehicle(true);
    setDeleteConfirmationError("");
    setDeleteCodeError("");
    setActionFeedback({ message: "", type: "" });
    try {
      await requestVehicleDeletionCode();
      savePendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);
      setDeleteCode(createEmptyCode());
      setDeleteStep("code");
    } catch (error) {
      setDeleteCodeError(
        getAuthErrorMessage(error, "Não foi possível enviar o código. Tente novamente."),
      );
    } finally {
      setDeletingVehicle(false);
    }
  };

  const submitDeletionConfirmation = (event) => {
    event.preventDefault();
    void sendDeletionCode();
  };

  const cancelDeletionConfirmation = () => {
    clearPendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);
    setDeleteCode(createEmptyCode());
    setDeleteCodeError("");
    setDeleteConfirmation("");
    setDeleteConfirmationError("");
    setDeleteStep("confirmation");
    setActionFeedback({ message: "", type: "" });
  };

  const confirmVehicleDeletion = async (event) => {
    event.preventDefault();
    if (deletingVehicle) return;

    if (deleteCode.join("").length !== VERIFICATION_CODE_LENGTH) {
      setDeleteCodeError("Digite os seis números enviados para o seu e-mail cadastrado.");
      return;
    }

    let codeValidated = false;
    setDeletingVehicle(true);
    setDeleteCodeError("");
    setActionFeedback({ message: "", type: "" });
    try {
      const actionToken = await validateVehicleDeletionCode(deleteCode.join(""));
      codeValidated = true;
      clearPendingOtpRequest(VEHICLE_DELETION_OTP_PURPOSE, vehicleId);
      await deleteVehicle(vehicle.id, actionToken);
      router.replace("/garagem");
    } catch (error) {
      const message = getAuthErrorMessage(
        error,
        codeValidated
          ? "Não foi possível remover o veículo."
          : "O código não pôde ser validado. Tente novamente.",
      );

      if (codeValidated) {
        setDeleteCode(createEmptyCode());
        setDeleteStep("confirmation");
        setDeleteCodeError(`${message} Solicite um novo código para tentar novamente.`);
      } else {
        setDeleteCodeError(message);
      }
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
            <p>
              {vehicle.version}
              {vehicle.color ? ` · ${vehicle.color}` : ""}
            </p>
          </div>
          <VehiclePlate plate={vehicle.plate} type={vehicle.type} />
        </section>

        <section aria-labelledby="management-options-title" className={styles.optionsSection}>
          <header className={styles.sectionHeading}>
            <h2 id="management-options-title">Opções do veículo</h2>
            <p>Selecione a operação que deseja realizar</p>
          </header>

          <div className="app-action-list">
            <button
              aria-expanded={activeAction === "mileage"}
              className={`app-action-item ${activeAction === "mileage" ? "app-action-item--active" : ""}`}
              onClick={openMileageAction}
              type="button"
            >
              <span className="app-action-icon">
                <GaugeIcon aria-hidden size={24} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Atualizar quilometragem</strong>
                <span>Odômetro atual: {mileageFormatter.format(vehicle.mileage)} km</span>
              </span>
              <CaretRightIcon aria-hidden size={19} weight="bold" />
            </button>

            <button
              aria-expanded={activeAction === "color"}
              className={`app-action-item ${activeAction === "color" ? "app-action-item--active" : ""}`}
              onClick={openColorAction}
              type="button"
            >
              <span className="app-action-icon">
                <PaletteIcon aria-hidden size={24} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Alterar cor</strong>
                <span>Cor atual: {vehicle.color || "não informada"}</span>
              </span>
              <CaretRightIcon aria-hidden size={19} weight="bold" />
            </button>

            <Link
              className="app-action-item"
              href={`/garagem/${vehicle.id}/gerenciar/transferencia`}
            >
              <span className="app-action-icon">
                <ArrowsLeftRightIcon aria-hidden size={23} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Transferência</strong>
                <span>Alterar o proprietário responsável pelo veículo</span>
              </span>
              <CaretRightIcon aria-hidden size={19} weight="bold" />
            </Link>

            <button
              aria-expanded={activeAction === "plate"}
              className={`app-action-item ${activeAction === "plate" ? "app-action-item--active" : ""}`}
              disabled={!plateCanBeConverted}
              onClick={openPlateAction}
              type="button"
            >
              <span className="app-action-icon">
                <IdentificationCardIcon aria-hidden size={24} weight="duotone" />
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
                  <CheckCircleIcon aria-hidden size={17} weight="fill" />
                  Atualizada
                </span>
              ) : (
                <CaretRightIcon aria-hidden size={19} weight="bold" />
              )}
            </button>

            <button
              aria-expanded={activeAction === "delete"}
              className={`app-action-item ${styles.dangerAction} ${activeAction === "delete" ? "app-action-item--active" : ""}`}
              onClick={openDeleteAction}
              type="button"
            >
              <span className={`app-action-icon ${styles.dangerIcon}`}>
                <TrashIcon aria-hidden size={23} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Remover da garagem</strong>
                <span>Remover o veículo e seu histórico da garagem</span>
              </span>
              <CaretRightIcon aria-hidden size={19} weight="bold" />
            </button>
          </div>
        </section>

        {activeAction === "mileage" && (
          <section className={`app-card ${styles.actionPanel}`} ref={actionPanelRef}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <GaugeIcon aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Atualizar quilometragem</h2>
                <p>O odômetro não pode ser reduzido depois da atualização</p>
              </div>
            </div>

            <form className={styles.mileageForm} noValidate onSubmit={submitMileage}>
              <label className="app-field">
                <span>Quilometragem atual (km)</span>
                <span
                  className={`app-control-shell ${styles.mileageInput}`}
                  data-error={Boolean(mileageError)}
                >
                  <GaugeIcon aria-hidden size={20} weight="regular" />
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
                  ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                  : <FloppyDiskIcon aria-hidden size={20} weight="bold" />}
                {updatingMileage ? "Atualizando..." : "Salvar quilometragem"}
              </ActionButton>
            </form>
          </section>
        )}

        {activeAction === "color" && (
          <section className={`app-card ${styles.actionPanel}`} ref={actionPanelRef}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <PaletteIcon aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Alterar cor do veículo</h2>
                <p>Informe a cor atual do veículo</p>
              </div>
            </div>

            <form className={styles.updateForm} noValidate onSubmit={submitColor}>
              <label className="app-field">
                <span>Cor do veículo</span>
                <span
                  className={`app-control-shell ${styles.updateInput}`}
                  data-error={Boolean(colorError)}
                >
                  <PaletteIcon aria-hidden size={20} weight="regular" />
                  <input
                    autoComplete="off"
                    disabled={updatingColor}
                    maxLength={255}
                    onChange={(event) => {
                      setColorValue(event.target.value);
                      setColorError("");
                      setActionFeedback({ message: "", type: "" });
                    }}
                    placeholder="Ex.: Prata"
                    value={colorValue}
                  />
                </span>
                {colorError && <small className="app-error-text">{colorError}</small>}
              </label>

              <ActionButton disabled={updatingColor} type="submit">
                {updatingColor
                  ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                  : <FloppyDiskIcon aria-hidden size={20} weight="bold" />}
                {updatingColor ? "Atualizando..." : "Salvar cor"}
              </ActionButton>
            </form>
          </section>
        )}

        {activeAction === "plate" && plateCanBeConverted && (
          <section className={`app-card ${styles.actionPanel}`} ref={actionPanelRef}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <IdentificationCardIcon aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Converter para o padrão Mercosul</h2>
                <p>A nova combinação é calculada automaticamente</p>
              </div>
            </div>

            <div aria-label="Conversão da placa" className={styles.plateComparison}>
              <div className={styles.plateStage}>
                <span>Placa atual</span>
                <VehiclePlate plate={vehicle.plate} type={vehicle.type} />
              </div>
              <ArrowRightIcon aria-hidden className={styles.conversionArrow} size={24} weight="bold" />
              <div className={styles.plateStage}>
                <span>Nova placa</span>
                <VehiclePlate plate={convertedPlate} type={vehicle.type} />
              </div>
            </div>

            <p className="app-feedback app-feedback--info">
              <InfoIcon aria-hidden size={18} weight="fill" />
              Apenas o segundo número do bloco numérico é convertido para a letra oficial correspondente.
            </p>

            {plateStep === "review" ? (
              <div className={styles.confirmationStep}>
                <div className={styles.securityNotice}>
                  <ShieldCheckIcon aria-hidden size={22} weight="duotone" />
                  <div>
                    <strong>Confirmação de segurança</strong>
                    <p>Enviaremos um código OTP para o e-mail cadastrado antes de alterar a placa</p>
                  </div>
                </div>
                <ActionButton disabled={platePending} onClick={sendPlateChangeCode} type="button">
                  <EnvelopeSimpleIcon aria-hidden size={20} weight="bold" />
                  {platePending ? "Enviando código..." : "Enviar código de confirmação"}
                </ActionButton>
                {plateCodeError && <p className="app-error-text" role="alert">{plateCodeError}</p>}
              </div>
            ) : (
              <form className={styles.verificationForm} noValidate onSubmit={confirmPlateChange}>
                <div className={styles.verificationHeading}>
                  <h3>Confirme a alteração</h3>
                  <p>Digite o código de seis dígitos enviado para o seu e-mail cadastrado</p>
                  <p>O código permanece válido por até 10 minutos após o envio.</p>
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
                    <ShieldCheckIcon aria-hidden size={20} weight="bold" />
                    {platePending ? "Confirmando..." : "Confirmar e converter placa"}
                  </ActionButton>
                  <ActionButton
                    disabled={platePending}
                    onClick={cancelPlateConfirmation}
                    type="button"
                    variant="secondary"
                  >
                    <XIcon aria-hidden size={20} weight="bold" />
                    Cancelar alteração
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
                <ShieldWarningIcon aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Remover veículo da garagem</h2>
                <p>O veículo será removido da garagem juntamente com todo o seu histórico</p>
              </div>
            </div>

            {deleteStep === "confirmation" ? (
              <form className={styles.deleteForm} noValidate onSubmit={submitDeletionConfirmation}>
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
                        setDeleteCodeError("");
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

                <div className={styles.securityNotice}>
                  <ShieldCheckIcon aria-hidden size={22} weight="duotone" />
                  <div>
                    <strong>Confirmação de segurança</strong>
                    <p>Enviaremos um código para o seu e-mail antes de remover o veículo</p>
                  </div>
                </div>

                <ActionButton disabled={deletingVehicle} type="submit">
                  {deletingVehicle
                    ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                    : <EnvelopeSimpleIcon aria-hidden size={20} weight="bold" />}
                  {deletingVehicle ? "Enviando código..." : "Enviar código de confirmação"}
                </ActionButton>
                {deleteCodeError && <p className="app-error-text" role="alert">{deleteCodeError}</p>}
              </form>
            ) : (
              <form className={styles.verificationForm} noValidate onSubmit={confirmVehicleDeletion}>
                <div className={styles.verificationHeading}>
                  <h3>Confirme a remoção</h3>
                  <p>Digite o código de seis dígitos enviado para o seu e-mail cadastrado</p>
                  <p>O código permanece válido por até 10 minutos após o envio.</p>
                </div>
                <VerificationCodeFields
                  code={deleteCode}
                  error={deleteCodeError}
                  onChange={(nextCode) => {
                    setDeleteCode(nextCode);
                    setDeleteCodeError("");
                  }}
                />
                {deleteCodeError && <p className="app-error-text">{deleteCodeError}</p>}
                <div className={styles.verificationActions}>
                  <button
                    className={styles.resendButton}
                    disabled={deletingVehicle}
                    onClick={() => void sendDeletionCode()}
                    type="button"
                  >
                    {deletingVehicle ? "Aguarde..." : "Reenviar código"}
                  </button>
                  <ActionButton disabled={deletingVehicle} type="submit" variant="danger">
                    {deletingVehicle
                      ? <CircleNotchIcon aria-hidden className={styles.loadingIcon} size={20} weight="bold" />
                      : <TrashIcon aria-hidden size={20} weight="bold" />}
                    {deletingVehicle ? "Confirmando..." : "Confirmar e remover veículo"}
                  </ActionButton>
                  <ActionButton
                    disabled={deletingVehicle}
                    onClick={cancelDeletionConfirmation}
                    type="button"
                    variant="secondary"
                  >
                    <XIcon aria-hidden size={20} weight="bold" />
                    Cancelar remoção
                  </ActionButton>
                </div>
              </form>
            )}
          </section>
        )}

        {actionFeedback.message && (
          <p
            className={`app-feedback app-feedback--${actionFeedback.type || "success"}`}
            role={actionFeedback.type === "error" ? "alert" : "status"}
          >
            {actionFeedback.type === "error"
              ? <WarningCircleIcon aria-hidden size={18} weight="fill" />
              : <CheckCircleIcon aria-hidden size={18} weight="fill" />}
            {actionFeedback.message}
          </p>
        )}
      </main>
    </AppShell>
  );
}
