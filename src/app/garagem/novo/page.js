"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  CircleNotch,
  Gauge,
  IdentificationCard,
  Motorcycle,
  Palette,
  Truck,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import AppShell from "../../components/app-shell";
import SearchableSelect from "../../components/searchable-select";
import PageTopBar from "../_components/page-top-bar";
import VehicleRegistrationLimit from "../_components/vehicle-registration-limit";
import VehicleTransferSuggestion from "../_components/vehicle-transfer-suggestion";
import {
  getBrands,
  getBrandYears,
  getModelsByYear,
  vehicleTypes,
} from "../_lib/fipe-api";
import {
  buildVehiclePayload,
  createVehicle,
  getCachedVehiclePage,
  getVehicleErrorMessage,
  getVehicleFieldErrors,
  getVehicleTransferSuggestion,
  listVehiclePage,
} from "../_lib/garage-api";
import { hasReachedVehicleRegistrationLimit } from "../_lib/vehicle-registration-limit";
import { saveVehicleTransferPrefill } from "../_lib/vehicle-transfer-prefill";
import { saveNavigationFeedback } from "../../lib/navigation-feedback";
import {
  formatPlateInput,
  onlyDigits,
  validateVehicleForm,
} from "../_lib/garage-validation";
import styles from "./page.module.css";

const initialForm = {
  type: "cars",
  color: "",
  plate: "",
  renavam: "",
  brand: "",
  model: "",
  year: "",
  mileage: "",
};

const vehicleTypeIcons = {
  cars: Car,
  motorcycles: Motorcycle,
  trucks: Truck,
};

const vehicleTypeShortLabels = {
  cars: "Carros e utilitários",
  motorcycles: "Motocicletas e triciclos",
  trucks: "Caminhões e ônibus",
};

export default function NewVehiclePage() {
  const router = useRouter();
  const [garageState, setGarageState] = useState(() => {
    const cached = getCachedVehiclePage();
    return {
      error: "",
      loading: cached === null,
      total: cached?.total ?? cached?.items.length ?? 0,
    };
  });
  const [garageRetryRevision, setGarageRetryRevision] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState({
    brands: false,
    models: false,
    years: false,
  });
  const [fipeError, setFipeError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transferSuggestion, setTransferSuggestion] = useState(null);
  const [failedBrandLogoSrc, setFailedBrandLogoSrc] = useState("");
  const registrationLimitReached = !garageState.loading
    && !garageState.error
    && hasReachedVehicleRegistrationLimit(garageState.total);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.code === form.brand),
    [brands, form.brand],
  );

  const brandLogoSrc = selectedBrand
    ? `/brandLogos/${form.type}/${selectedBrand.code}.webp`
    : "";

  const selectedYear = useMemo(
    () => years.find((year) => year.code === form.year),
    [years, form.year],
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.code === form.model),
    [models, form.model],
  );

  const loadBrands = useCallback(async (vehicleType) => {
    setBrands([]);
    setModels([]);
    setYears([]);
    setFipeError("");
    setLoading((current) => ({ ...current, brands: true }));

    try {
      setBrands(await getBrands(vehicleType));
    } catch {
      setFipeError("Não foi possível carregar as marcas da tabela FIPE.");
    } finally {
      setLoading((current) => ({ ...current, brands: false }));
    }
  }, []);

  const loadYears = useCallback(async (vehicleType, brandId) => {
    setYears([]);
    setModels([]);
    setFipeError("");
    setLoading((current) => ({ ...current, years: true }));

    try {
      setYears(await getBrandYears(vehicleType, brandId));
    } catch {
      setFipeError("Não foi possível carregar os anos da tabela FIPE.");
    } finally {
      setLoading((current) => ({ ...current, years: false }));
    }
  }, []);

  const loadModels = useCallback(async (vehicleType, brandId, yearId) => {
    setModels([]);
    setFipeError("");
    setLoading((current) => ({ ...current, models: true }));

    try {
      setModels(await getModelsByYear(vehicleType, brandId, yearId));
    } catch {
      setFipeError("Não foi possível carregar os modelos da tabela FIPE.");
    } finally {
      setLoading((current) => ({ ...current, models: false }));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadGarageTotal() {
      setGarageState((current) => ({ ...current, error: "", loading: true }));

      try {
        const vehiclePage = await listVehiclePage(1);
        if (active) {
          setGarageState({
            error: "",
            loading: false,
            total: vehiclePage.total,
          });
        }
      } catch (error) {
        if (active) {
          setGarageState({
            error: getVehicleErrorMessage(
              error,
              "Não foi possível verificar a disponibilidade da sua garagem.",
            ),
            loading: false,
            total: 0,
          });
        }
      }
    }

    void loadGarageTotal();
    return () => { active = false; };
  }, [garageRetryRevision]);

  useEffect(() => {
    if (garageState.loading || garageState.error || registrationLimitReached) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadBrands(initialForm.type);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [garageState.error, garageState.loading, loadBrands, registrationLimitReached]);

  const clearError = (field) => {
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const updateField = (field, value) => {
    setSubmitError("");
    setTransferSuggestion(null);
    clearError(field);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateVehicleType = (value) => {
    setSubmitError("");
    setTransferSuggestion(null);
    setErrors({});
    setForm((current) => ({
      ...current,
      type: value,
      brand: "",
      model: "",
      year: "",
    }));
    void loadBrands(value);
  };

  const updateBrand = (value) => {
    setSubmitError("");
    setTransferSuggestion(null);
    setErrors((current) => ({ ...current, brand: "", model: "", year: "" }));
    setForm((current) => ({ ...current, brand: value, model: "", year: "" }));
    setModels([]);
    setYears([]);
    if (value) void loadYears(form.type, value);
  };

  const updateYear = (value) => {
    setSubmitError("");
    setTransferSuggestion(null);
    setErrors((current) => ({ ...current, model: "", year: "" }));
    setForm((current) => ({ ...current, model: "", year: value }));
    setModels([]);
    if (value) void loadModels(form.type, form.brand, value);
  };

  const updateModel = (value) => {
    setSubmitError("");
    setTransferSuggestion(null);
    setErrors((current) => ({ ...current, model: "" }));
    setForm((current) => ({ ...current, model: value }));
  };

  const submitVehicle = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validateVehicleForm(form);
    setErrors(validationErrors);
    setSubmitError("");
    setTransferSuggestion(null);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildVehiclePayload({
        form,
        brand: selectedBrand,
        model: selectedModel,
        year: selectedYear,
      });
      const vehicle = await createVehicle(payload);
      saveNavigationFeedback("Veículo cadastrado com sucesso.");
      router.replace(`/garagem/${vehicle.id}`);
    } catch (error) {
      const suggestion = getVehicleTransferSuggestion(error);
      setErrors(getVehicleFieldErrors(error));
      setTransferSuggestion(suggestion);
      setSubmitError(suggestion
        ? ""
        : getVehicleErrorMessage(
          error,
          "Não foi possível cadastrar o veículo. Tente novamente.",
        ));
    } finally {
      setSubmitting(false);
    }
  };

  const requestTransfer = () => {
    const saved = saveVehicleTransferPrefill({
      plate: form.plate,
      renavam: form.renavam,
    });
    if (!saved) {
      setSubmitError("Não foi possível preparar a solicitação. Tente novamente.");
      return;
    }
    router.push("/garagem/transferencia");
  };

  const brandPlaceholder = loading.brands
    ? "Carregando marcas..."
    : "Selecione a marca";
  const modelPlaceholder = loading.models
    ? "Carregando modelos..."
    : selectedYear
      ? "Selecione o modelo"
      : "Aguardando ano...";
  const yearPlaceholder = loading.years
    ? "Carregando anos..."
    : selectedBrand
      ? "Selecione o ano/combustível"
      : "Aguardando marca...";

  return (
    <AppShell>
      <PageTopBar title="Novo Veículo" />

      {garageState.loading ? (
        <main className={styles.limitScreen}>
          <section className="app-empty-state app-empty-state--narrow" role="status">
            <CircleNotch aria-hidden className={styles.submitIcon} size={26} weight="bold" />
            <p>Verificando disponibilidade da garagem...</p>
          </section>
        </main>
      ) : garageState.error ? (
        <main className={styles.limitScreen}>
          <section className="app-empty-state app-empty-state--narrow" role="alert">
            <h2>Não foi possível verificar sua garagem</h2>
            <p>{garageState.error}</p>
            <button
              className="app-empty-link"
              onClick={() => setGarageRetryRevision((revision) => revision + 1)}
              type="button"
            >
              Tentar novamente
            </button>
          </section>
        </main>
      ) : registrationLimitReached ? (
        <main className={styles.limitScreen}>
          <VehicleRegistrationLimit standalone />
        </main>
      ) : (
        <main className={`app-form-screen ${styles.formScreen}`}>
        <div className={styles.iconCircle}>
          {selectedBrand && failedBrandLogoSrc !== brandLogoSrc ? (
            <Image
              alt={`Logo ${selectedBrand.name}`}
              height={150}
              width={150}
              src={brandLogoSrc}
              onError={() => setFailedBrandLogoSrc(brandLogoSrc)}
              className={styles.brandLogo}
            />
          ) : (
            <Car aria-hidden size={36} weight="fill" className={styles.icon} />
          )}
        </div>
        <div className={`app-form-heading ${styles.heading}`}>
          <h2>Detalhes do Veículo</h2>
          <p>Integração automática com a tabela FIPE</p>
        </div>

        <form
          className={`app-form-card ${styles.vehicleForm}`}
          id="new-vehicle-form"
          noValidate
          onSubmit={submitVehicle}
        >
          <fieldset className={styles.vehicleTypeField}>
            <legend>Tipo de veículo</legend>
            <div className={styles.vehicleTypeOptions}>
              {vehicleTypes.map((type) => {
                const TypeIcon = vehicleTypeIcons[type.value];
                const selected = form.type === type.value;

                return (
                  <button
                    aria-label={type.label}
                    aria-pressed={selected}
                    className={styles.vehicleTypeButton}
                    data-selected={selected}
                    disabled={submitting || loading.brands}
                    key={type.value}
                    onClick={() => updateVehicleType(type.value)}
                    title={type.label}
                    type="button"
                  >
                    <TypeIcon aria-hidden size={25} weight={selected ? "fill" : "duotone"} />
                    <strong>{vehicleTypeShortLabels[type.value]}</strong>
                  </button>
                );
              })}
            </div>
            {errors.type && (
              <small className="app-error-text">{errors.type}</small>
            )}
          </fieldset>

          <SearchableSelect
            disabled={loading.brands || submitting}
            emptyMessage="Nenhuma marca encontrada."
            error={errors.brand}
            getOptionImage={(brand) =>
              `/brandLogos/${form.type}/${brand.code}.webp`
            }
            label="Marca"
            loading={loading.brands}
            onChange={updateBrand}
            options={brands}
            placeholder={brandPlaceholder}
            searchPlaceholder="Buscar marca..."
            value={form.brand}
          />

          <SearchableSelect
            disabled={!selectedBrand || loading.years || submitting}
            emptyMessage="Nenhum ano encontrado para a marca selecionada."
            error={errors.year}
            hint="A FIPE pode retornar o mesmo ano com combustíveis diferentes."
            label="Ano / Modelo"
            loading={loading.years}
            onChange={updateYear}
            options={years}
            placeholder={yearPlaceholder}
            searchPlaceholder="Buscar ano ou combustível..."
            value={form.year}
          />

          <SearchableSelect
            disabled={!selectedYear || loading.models || submitting}
            emptyMessage="Nenhum modelo encontrado para o ano selecionado."
            error={errors.model}
            label="Modelo"
            loading={loading.models}
            onChange={updateModel}
            options={models}
            placeholder={modelPlaceholder}
            searchPlaceholder="Buscar modelo..."
            value={form.model}
          />

          <label className="app-field app-field--uppercase">
            <span>Cor do veículo</span>
            <span
              className={`app-control-shell ${styles.inputShell}`}
              data-error={Boolean(errors.color)}
            >
              <Palette aria-hidden size={20} weight="regular" />
              <input
                autoComplete="off"
                disabled={submitting}
                maxLength={255}
                name="color"
                onChange={(event) => updateField("color", event.target.value)}
                placeholder="Ex: Prata"
                value={form.color}
              />
            </span>
            {errors.color && (
              <small className="app-error-text">{errors.color}</small>
            )}
          </label>

          <label className="app-field app-field--uppercase">
            <span>Placa do veículo</span>
            <span
              className={`app-control-shell ${styles.inputShell}`}
              data-error={Boolean(errors.plate)}
            >
              <IdentificationCard aria-hidden size={20} weight="regular" />
              <input
                autoComplete="off"
                autoCapitalize="characters"
                disabled={submitting}
                maxLength={8}
                name="plate"
                onChange={(event) =>
                  updateField("plate", formatPlateInput(event.target.value))
                }
                placeholder="AAA-1234 ou ABC1D23"
                spellCheck={false}
                value={form.plate}
              />
            </span>
            {errors.plate ? (
              <small className="app-error-text">{errors.plate}</small>
            ) : (
              <small>Padrão Mercosul ou antigo</small>
            )}
          </label>

          <label className="app-field app-field--uppercase">
            <span>RENAVAM</span>
            <span
              className={`app-control-shell ${styles.inputShell}`}
              data-error={Boolean(errors.renavam)}
            >
              <IdentificationCard aria-hidden size={20} weight="regular" />
              <input
                autoComplete="off"
                disabled={submitting}
                inputMode="numeric"
                maxLength={11}
                name="renavam"
                onChange={(event) =>
                  updateField("renavam", onlyDigits(event.target.value))
                }
                pattern="[0-9]*"
                placeholder="12345678900"
                value={form.renavam}
              />
            </span>
            {errors.renavam ? (
              <small className="app-error-text">{errors.renavam}</small>
            ) : (
              <small>O RENAVAM pode possuir 9 ou 11 dígitos</small>
            )}
          </label>

          <label className="app-field app-field--uppercase">
            <span>Quilometragem inicial</span>
            <span
              className={`app-control-shell ${styles.inputShell}`}
              data-error={Boolean(errors.mileage)}
            >
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                disabled={submitting}
                inputMode="numeric"
                name="mileage"
                onChange={(event) =>
                  updateField("mileage", onlyDigits(event.target.value))
                }
                placeholder="Ex: 50000"
                value={form.mileage}
              />
              <em>km</em>
            </span>
            {errors.mileage && (
              <small className="app-error-text">{errors.mileage}</small>
            )}
          </label>

          {fipeError && (
            <p className="app-feedback app-feedback--error" role="alert">{fipeError}</p>
          )}
          {submitError && (
            <p className="app-feedback app-feedback--error" role="alert">{submitError}</p>
          )}
          {transferSuggestion ? (
            <VehicleTransferSuggestion
              disabled={submitting}
              onRequest={requestTransfer}
              ownerHint={transferSuggestion.ownerHint}
            />
          ) : (
            <ActionButton disabled={submitting} form="new-vehicle-form" type="submit">
              {submitting
                ? <CircleNotch aria-hidden className={styles.submitIcon} size={21} weight="bold" />
                : <Car aria-hidden size={21} weight="bold" />}
              {submitting ? "Adicionando veículo..." : "Adicionar veículo à garagem"}
            </ActionButton>
          )}
        </form>
        </main>
      )}
    </AppShell>
  );
}
