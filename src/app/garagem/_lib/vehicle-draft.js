const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "legadocar:vehicle-draft";
const VALID_VEHICLE_TYPES = new Set(["cars", "motorcycles", "trucks"]);
const DRAFT_FIELDS = ["brand", "model", "year", "color", "plate", "renavam", "mileage"];

function getBrowserStorage(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeDraftForm(form = {}) {
  const normalized = {
    type: VALID_VEHICLE_TYPES.has(form.type) ? form.type : "cars",
  };
  for (const field of DRAFT_FIELDS) normalized[field] = String(form[field] ?? "");
  return normalized;
}

export function createVehicleDraftKey(userId) {
  const owner = Number(userId);
  if (!Number.isInteger(owner) || owner <= 0) return "";
  return `${DRAFT_PREFIX}:v${DRAFT_VERSION}:user-${owner}`;
}

export function hasVehicleDraftContent(form = {}) {
  const meaningfulFields = [
    form.brand,
    form.model,
    form.year,
    form.color,
    form.plate,
    form.renavam,
    form.mileage,
  ];
  return form.type !== "cars"
    || meaningfulFields.some((value) => String(value ?? "").trim());
}

export function readVehicleDraft(key, storage) {
  if (!key) return null;
  try {
    const raw = getBrowserStorage(storage)?.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== DRAFT_VERSION || !isObject(draft.form)) return null;
    return {
      form: normalizeDraftForm(draft.form),
      updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function saveVehicleDraft(key, form, storage) {
  const normalizedForm = normalizeDraftForm(form);
  if (!key || !hasVehicleDraftContent(normalizedForm)) return false;
  try {
    getBrowserStorage(storage)?.setItem(key, JSON.stringify({
      form: normalizedForm,
      updatedAt: new Date().toISOString(),
      version: DRAFT_VERSION,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearVehicleDraft(key, storage) {
  if (!key) return;
  try {
    getBrowserStorage(storage)?.removeItem(key);
  } catch {
    // O formulário continua disponível quando o armazenamento está bloqueado.
  }
}
