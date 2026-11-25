const FIPE_API_BASE_URL = process.env.NEXT_PUBLIC_FIPE_API_URL || "https://fipe.parallelum.com.br/api/v2";
const FIPE_REQUEST_TIMEOUT_MS = 8000;

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

function getYearNumber(option) {
  const match = `${option.name} ${option.code}`.match(/\b\d{4}\b/);
  return match ? Number(match[0]) : 0;
}

async function fetchFipeOptions(path) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FIPE_REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(FIPE_API_BASE_URL + path, { signal: controller.signal });
  } catch {
    throw new Error("Não foi possível carregar os dados da tabela FIPE.");
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados da tabela FIPE.");
  }

  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeFipeOption) : [];
}

export function getBrands(vehicleType) {
  return fetchFipeOptions("/" + vehicleType + "/brands");
}

export async function getBrandYears(vehicleType, brandId) {
  const years = await fetchFipeOptions(
    "/" + vehicleType + "/brands/" + brandId + "/years",
  );

  return years
    .filter((year) => !isZeroKmYearOption(year))
    .sort((firstYear, secondYear) => getYearNumber(secondYear) - getYearNumber(firstYear));
}

export function getModelsByYear(vehicleType, brandId, yearId) {
  return fetchFipeOptions(
    "/" + vehicleType + "/brands/" + brandId + "/years/" + yearId + "/models",
  );
}
