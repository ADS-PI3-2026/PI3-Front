"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Car,
  CaretDown,
  FloppyDisk,
  Gauge,
  IdentificationCard,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import AppShell from "../../components/app-shell";
import SearchableSelect from "../../components/searchable-select";
import styles from "./page.module.css";

const FIPE_API_BASE_URL = "https://fipe.parallelum.com.br/api/v2";

const vehicleTypes = [
  { value: "cars", label: "Carro ou utilitário pequeno" },
  { value: "motorcycles", label: "Moto" },
  { value: "trucks", label: "Caminhão ou Micro-ônibus" },
];

const initialForm = {
  type: "cars",
  plate: "",
  brand: "",
  model: "",
  year: "",
  mileage: "",
  documentName: "",
};

function normalizeFipeOption(option) {
  return {
    code: String(option.code ?? option.id ?? ""),
    name: option.name ?? option.label ?? "",
  };
}

function isZeroKmYearOption(option) {
  return option.code === "32000" || option.name.trim().startsWith("32000");
}

async function fetchFipeOptions(path) {
  const response = await fetch(FIPE_API_BASE_URL + path);

  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados da tabela FIPE.");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeFipeOption) : [];
}

export default function NewVehiclePage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState({ brands: false, models: false, years: false });
  const [fipeError, setFipeError] = useState("");
  const [message, setMessage] = useState("");

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.code === form.brand),
    [brands, form.brand],
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.code === form.model),
    [models, form.model],
  );

  const selectedYear = useMemo(
    () => years.find((year) => year.code === form.year),
    [years, form.year],
  );

  const loadBrands = useCallback(async (vehicleType) => {
    setBrands([]);
    setModels([]);
    setYears([]);
    setFipeError("");
    setLoading((current) => ({ ...current, brands: true }));

    try {
      const options = await fetchFipeOptions("/" + vehicleType + "/brands");
      console.log(options);
      setBrands(options);
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
      const options = await fetchFipeOptions("/" + vehicleType + "/brands/" + brandId + "/models");
      setModels(options);
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
      const options = await fetchFipeOptions("/" + vehicleType + "/brands/" + brandId + "/models/" + modelId + "/years");
      setYears(options.filter((option) => !isZeroKmYearOption(option)));
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

  const updateField = (field, value) => {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateVehicleType = (value) => {
    setMessage("");
    setForm((current) => ({ ...current, type: value, brand: "", model: "", year: "" }));
    void loadBrands(value);
  };

  const updateBrand = (value) => {
    setMessage("");
    setForm((current) => ({ ...current, brand: value, model: "", year: "" }));
    setModels([]);
    setYears([]);
    if (value) void loadModels(form.type, value);
  };

  const updateModel = (value) => {
    setMessage("");
    setForm((current) => ({ ...current, model: value, year: "" }));
    setYears([]);
    if (value) void loadYears(form.type, form.brand, value);
  };

  const submitVehicle = (event) => {
    event.preventDefault();

    const payload = {
      vehicleType: form.type,
      plate: form.plate.trim().toUpperCase(),
      brandId: form.brand,
      brandName: selectedBrand?.name ?? "",
      modelId: form.model,
      modelName: selectedModel?.name ?? "",
      yearId: form.year,
      yearName: selectedYear?.name ?? "",
      initialMileage: form.mileage,
      documentName: form.documentName,
    };

    console.info("Payload de veículo pronto para o backend", payload);
    setMessage("Veículo validado em modo de pré-visualização. Os códigos FIPE estão prontos para envio ao backend.");
  };

  const brandPlaceholder = loading.brands ? "Carregando marcas..." : "Selecione a marca";
  const modelPlaceholder = loading.models
    ? "Carregando modelos..."
    : selectedBrand
      ? "Selecione o modelo"
      : "Aguardando marca...";
  const yearPlaceholder = loading.years
    ? "Carregando anos..."
    : selectedModel
      ? "Selecione o ano/combustível"
      : "Aguardando modelo...";

  return (
    <AppShell>
      <header className={styles.topBar}>
        <button aria-label="Voltar" className={styles.backButton} onClick={() => router.back()} type="button">
          <ArrowLeft aria-hidden size={24} weight="bold" />
        </button>
        <h1>Novo Veículo</h1>
        <span />
      </header>

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
            <span className={styles.selectShell}>
              <select value={form.type} onChange={(event) => updateVehicleType(event.target.value)}>
                {vehicleTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <CaretDown aria-hidden size={18} weight="bold" />
            </span>
          </label>

          <SearchableSelect
            disabled={loading.brands}
            emptyMessage="Nenhuma marca encontrada."
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
            <span className={styles.selectShell} data-disabled={!selectedModel || loading.years}>
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
            <small className={styles.fieldHint}>A FIPE pode retornar o mesmo ano com combustíveis diferentes.</small>
          </label>

          <label className={styles.field}>
            <span>Placa do veículo</span>
            <span className={styles.inputShell}>
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
            <small>Padrão Mercosul ou antigo.</small>
          </label>

          <label className={styles.field}>
            <span>Quilometragem inicial</span>
            <span className={styles.inputShell}>
              <Gauge aria-hidden size={20} weight="regular" />
              <input
                inputMode="numeric"
                name="mileage"
                onChange={(event) => updateField("mileage", event.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 50000"
                value={form.mileage}
              />
              <em>km</em>
            </span>
          </label>

          <label className={styles.field}>
            <span>Documento do veículo (CRLV)</span>
            <span className={styles.uploadBox}>
              <UploadSimple aria-hidden size={30} weight="bold" />
              <strong>{form.documentName || "Anexar documento CRLV"}</strong>
              <small>PNG, JPG, PDF até 10MB</small>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                name="document"
                onChange={(event) => updateField("documentName", event.target.files?.[0]?.name ?? "")}
              />
            </span>
          </label>

          {fipeError && (
            <p className={styles.errorMessage}>
              <WarningCircle aria-hidden size={19} weight="fill" />
              {fipeError}
            </p>
          )}
          {message && <p className={styles.successMessage}>{message}</p>}
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
