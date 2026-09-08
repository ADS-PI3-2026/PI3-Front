const FIPE_API_BASE_URL = "https://fipe.parallelum.com.br/api/v2";

export const vehicleTypes = [
  { value: "cars", label: "Carro ou utilitário pequeno" },
  { value: "motorcycles", label: "Moto" },
  { value: "trucks", label: "Caminhão ou Micro-ônibus" },
];

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

export function getBrands(vehicleType) {
  return fetchFipeOptions("/" + vehicleType + "/brands");
}

export function getModels(vehicleType, brandId) {
  return fetchFipeOptions("/" + vehicleType + "/brands/" + brandId + "/models");
}

export async function getYears(vehicleType, brandId, modelId) {
  const years = await fetchFipeOptions("/" + vehicleType + "/brands/" + brandId + "/models/" + modelId + "/years");
  return years.filter((year) => !isZeroKmYearOption(year));
}
