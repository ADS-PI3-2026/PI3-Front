"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  CaretDown,
  CircleNotch,
  Gauge,
  IdentificationCard,
  Palette,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import AppShell from "../../components/app-shell";
import SearchableSelect from "../../components/searchable-select";
import PageTopBar from "../_components/page-top-bar";
import {
  getBrands,
  getBrandYears,
  getModelsByYear,
  vehicleTypes,
} from "../_lib/fipe-api";
import {
  buildVehiclePayload,
  createVehicle,
  getVehicleErrorMessage,
  getVehicleFieldErrors,
} from "../_lib/garage-api";
import { onlyDigits, validateVehicleForm } from "../_lib/garage-validation";
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

export default function NewVehiclePage() {
  const router = useRouter();
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
  const [failedBrandLogoSrc, setFailedBrandLogoSrc] = useState("");

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
    const timer = window.setTimeout(() => {
      void loadBrands(initialForm.type);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBrands]);

  const clearError = (field) => {
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const updateField = (field, value) => {
    setSubmitError("");
    clearError(field);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateVehicleType = (value) => {
    setSubmitError("");
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
    setErrors((current) => ({ ...current, brand: "", model: "", year: "" }));
    setForm((current) => ({ ...current, brand: value, model: "", year: "" }));
    setModels([]);
    setYears([]);
    if (value) void loadYears(form.type, value);
  };

  const updateYear = (value) => {
    setSubmitError("");
    setErrors((current) => ({ ...current, model: "", year: "" }));
    setForm((current) => ({ ...current, model: "", year: value }));
    setModels([]);
    if (value) void loadModels(form.type, form.brand, value);
  };

  const updateModel = (value) => {
    setSubmitError("");
    setErrors((current) => ({ ...current, model: "" }));
    setForm((current) => ({ ...current, model: value }));
  };

  const submitVehicle = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validateVehicleForm(form);
    setErrors(validationErrors);
    setSubmitError("");
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = buildVehiclePayload({
        form,
        brand: selectedBrand,
        model: selectedModel,
        year: selectedYear,
      });
      await createVehicle(payload);
      router.push("/garagem");
    } catch (error) {
      setErrors(getVehicleFieldErrors(error));
      setSubmitError(getVehicleErrorMessage(
        error,
        "Não foi possível cadastrar o veículo. Tente novamente.",
      ));
    } finally {
      setSubmitting(false);
    }
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
          <label className="app-field app-field--uppercase">
            <span>Tipo de veículo</span>
            <span
              className={`app-control-shell ${styles.selectShell}`}
              data-error={Boolean(errors.type)}
            >
              <select
                disabled={submitting}
                onChange={(event) => updateVehicleType(event.target.value)}
                value={form.type}
              >
                {vehicleTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
            {errors.type && (
              <small className="app-error-text">{errors.type}</small>
            )}
          </label>

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

          <label className="app-field app-field--uppercase">
            <span>Ano / Modelo</span>
            <span
              className={`app-control-shell ${styles.selectShell}`}
              data-disabled={!selectedBrand || loading.years || submitting}
              data-error={Boolean(errors.year)}
            >
              <select
                disabled={!selectedBrand || loading.years || submitting}
                value={form.year}
                onChange={(event) => updateYear(event.target.value)}
              >
                <option value="">{yearPlaceholder}</option>
                {years.map((year) => (
                  <option key={year.code} value={year.code}>
                    {year.name}
                  </option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
            {errors.year ? (
              <small className="app-error-text">{errors.year}</small>
            ) : (
              <small className={styles.fieldHint}>
                A FIPE pode retornar o mesmo ano com combustíveis diferentes.
              </small>
            )}
          </label>

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
                disabled={submitting}
                maxLength={9}
                name="plate"
                onChange={(event) =>
                  updateField("plate", event.target.value.toUpperCase())
                }
                placeholder="AAA-1234 ou ABC1D23"
                value={form.plate}
              />
            </span>
            {errors.plate ? (
              <small className="app-error-text">{errors.plate}</small>
            ) : (
              <small>Padrão Mercosul ou antigo.</small>
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
              <small>O RENAVAM pode possuir 9 ou 11 dígitos.</small>
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
          <ActionButton disabled={submitting} form="new-vehicle-form" type="submit">
            {submitting
              ? <CircleNotch aria-hidden className={styles.submitIcon} size={21} weight="bold" />
              : <Car aria-hidden size={21} weight="bold" />}
            {submitting ? "Adicionando veículo..." : "Adicionar veículo à garagem"}
          </ActionButton>
        </form>
      </main>
    </AppShell>
  );
}
