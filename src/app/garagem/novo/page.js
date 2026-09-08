"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  CaretDown,
  FloppyDisk,
  Gauge,
  IdentificationCard,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import AppShell from "../../components/app-shell";
import SearchableSelect from "../../components/searchable-select";
import FileUploadField from "../_components/file-upload-field";
import PageTopBar from "../_components/page-top-bar";
import { getBrands, getModels, getYears, vehicleTypes } from "../_lib/fipe-api";
import { onlyDigits, validateVehicleForm } from "../_lib/garage-validation";
import styles from "./page.module.css";

const initialForm = {
  type: "cars",
  plate: "",
  brand: "",
  model: "",
  year: "",
  mileage: "",
  documentName: "",
};

export default function NewVehiclePage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState({ brands: false, models: false, years: false });
  const [fipeError, setFipeError] = useState("");

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.code === form.brand),
    [brands, form.brand],
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

  const loadModels = useCallback(async (vehicleType, brandId) => {
    setModels([]);
    setYears([]);
    setFipeError("");
    setLoading((current) => ({ ...current, models: true }));

    try {
      setModels(await getModels(vehicleType, brandId));
    } catch {
      setFipeError("Não foi possível carregar os modelos da tabela FIPE.");
    } finally {
      setLoading((current) => ({ ...current, models: false }));
    }
  }, []);

  const loadYears = useCallback(async (vehicleType, brandId, modelId) => {
    setYears([]);
    setFipeError("");
    setLoading((current) => ({ ...current, years: true }));

    try {
      setYears(await getYears(vehicleType, brandId, modelId));
    } catch {
      setFipeError("Não foi possível carregar os anos da tabela FIPE.");
    } finally {
      setLoading((current) => ({ ...current, years: false }));
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
    clearError(field);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateVehicleType = (value) => {
    setErrors({});
    setForm((current) => ({ ...current, type: value, brand: "", model: "", year: "" }));
    void loadBrands(value);
  };

  const updateBrand = (value) => {
    setErrors((current) => ({ ...current, brand: "", model: "", year: "" }));
    setForm((current) => ({ ...current, brand: value, model: "", year: "" }));
    setModels([]);
    setYears([]);
    if (value) void loadModels(form.type, value);
  };

  const updateModel = (value) => {
    setErrors((current) => ({ ...current, model: "", year: "" }));
    setForm((current) => ({ ...current, model: value, year: "" }));
    setYears([]);
    if (value) void loadYears(form.type, form.brand, value);
  };

  const submitVehicle = (event) => {
    event.preventDefault();
    setErrors(validateVehicleForm(form));
  };

  const brandPlaceholder = loading.brands ? "Carregando marcas..." : "Selecione a marca";
  const modelPlaceholder = loading.models ? "Carregando modelos..." : selectedBrand ? "Selecione o modelo" : "Aguardando marca...";
  const yearPlaceholder = loading.years ? "Carregando anos..." : selectedModel ? "Selecione o ano/combustível" : "Aguardando modelo...";

  return (
    <AppShell>
      <PageTopBar title="Novo Veículo" />

      <main className={styles.formScreen}>
        <div className={styles.iconCircle}>
          <Car aria-hidden size={36} weight="fill" />
        </div>
        <div className={styles.heading}>
          <h2>Detalhes do Veículo</h2>
          <p>Integração automática com a tabela FIPE</p>
        </div>

        <form className={styles.vehicleForm} id="new-vehicle-form" noValidate onSubmit={submitVehicle}>
          <label className={styles.field}>
            <span>Tipo de veículo</span>
            <span className={styles.selectShell} data-error={Boolean(errors.type)}>
              <select value={form.type} onChange={(event) => updateVehicleType(event.target.value)}>
                {vehicleTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
            {errors.type && <small className={styles.errorText}>{errors.type}</small>}
          </label>

          <SearchableSelect
            disabled={loading.brands}
            emptyMessage="Nenhuma marca encontrada."
            error={errors.brand}
            label="Marca"
            loading={loading.brands}
            onChange={updateBrand}
            options={brands}
            placeholder={brandPlaceholder}
            searchPlaceholder="Buscar marca..."
            value={form.brand}
          />

          <SearchableSelect
            disabled={!selectedBrand || loading.models}
            emptyMessage="Nenhum modelo encontrado."
            error={errors.model}
            label="Modelo"
            loading={loading.models}
            onChange={updateModel}
            options={models}
            placeholder={modelPlaceholder}
            searchPlaceholder="Buscar modelo..."
            value={form.model}
          />

          <label className={styles.field}>
            <span>Ano / Modelo</span>
            <span className={styles.selectShell} data-disabled={!selectedModel || loading.years} data-error={Boolean(errors.year)}>
              <select
                disabled={!selectedModel || loading.years}
                value={form.year}
                onChange={(event) => updateField("year", event.target.value)}
              >
                <option value="">{yearPlaceholder}</option>
                {years.map((year) => (
                  <option key={year.code} value={year.code}>{year.name}</option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
            {errors.year ? (
              <small className={styles.errorText}>{errors.year}</small>
            ) : (
              <small className={styles.fieldHint}>A FIPE pode retornar o mesmo ano com combustíveis diferentes.</small>
            )}
          </label>

          <label className={styles.field}>
            <span>Placa do veículo</span>
            <span className={styles.inputShell} data-error={Boolean(errors.plate)}>
              <IdentificationCard aria-hidden size={20} weight="regular" />
              <input
                autoComplete="off"
                maxLength={9}
                name="plate"
                onChange={(event) => updateField("plate", event.target.value.toUpperCase())}
                placeholder="AAA-1234 ou ABC1D23"
                value={form.plate}
              />
            </span>
            {errors.plate ? <small className={styles.errorText}>{errors.plate}</small> : <small>Padrão Mercosul ou antigo.</small>}
          </label>

          <label className={styles.field}>
            <span>Quilometragem inicial</span>
            <span className={styles.inputShell} data-error={Boolean(errors.mileage)}>
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                inputMode="numeric"
                name="mileage"
                onChange={(event) => updateField("mileage", onlyDigits(event.target.value))}
                placeholder="Ex: 50000"
                value={form.mileage}
              />
              <em>km</em>
            </span>
            {errors.mileage && <small className={styles.errorText}>{errors.mileage}</small>}
          </label>

          <FileUploadField
            accept=".png,.jpg,.jpeg,.pdf"
            error={errors.documentName}
            hint="PNG, JPG, PDF até 10MB"
            label="Documento do veículo (CRLV)"
            name="document"
            onChange={(value) => updateField("documentName", value)}
            value={form.documentName || "Anexar documento CRLV"}
          />

          {fipeError && <p className={styles.errorMessage}>{fipeError}</p>}
        </form>
      </main>

      <div className={styles.submitBar}>
        <ActionButton form="new-vehicle-form" type="submit">
          <FloppyDisk aria-hidden size={21} weight="bold" />
          Salvar Veículo
        </ActionButton>
      </div>
    </AppShell>
  );
}
