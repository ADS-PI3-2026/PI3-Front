const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "legadocar:maintenance-draft";

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

export function createMaintenanceDraftKey(userId, vehicleId) {
  const owner = Number(userId);
  const vehicle = Number(vehicleId);
  if (!Number.isInteger(owner) || owner <= 0 || !Number.isInteger(vehicle) || vehicle <= 0) {
    return "";
  }
  return `${DRAFT_PREFIX}:v${DRAFT_VERSION}:user-${owner}:vehicle-${vehicle}`;
}

export function hasMaintenanceDraftContent(form = {}, fieldValues = {}) {
  const meaningfulFields = [
    form.category,
    form.mileage,
    form.mileageDue,
    form.date,
    form.description,
    form.value,
  ];
  return meaningfulFields.some((value) => String(value ?? "").trim())
    || Object.values(fieldValues).some((value) => (
      Array.isArray(value) ? value.length > 0 : String(value ?? "").trim()
    ));
}

export function readMaintenanceDraft(key, storage) {
  if (!key) return null;
  try {
    const raw = getBrowserStorage(storage)?.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.version !== DRAFT_VERSION || !isObject(draft.form) || !isObject(draft.fieldValues)) {
      return null;
    }
    return {
      fieldValues: draft.fieldValues,
      form: { ...draft.form, receiptName: "" },
      queued: draft.queued === true,
      updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : "",
    };
  } catch {
    return null;
  }
}

export function saveMaintenanceDraft(key, { fieldValues = {}, form = {}, queued = false }, storage) {
  if (!key || !hasMaintenanceDraftContent(form, fieldValues)) return false;
  try {
    getBrowserStorage(storage)?.setItem(key, JSON.stringify({
      fieldValues,
      form: { ...form, receiptName: "" },
      queued: queued === true,
      updatedAt: new Date().toISOString(),
      version: DRAFT_VERSION,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearMaintenanceDraft(key, storage) {
  if (!key) return;
  try {
    getBrowserStorage(storage)?.removeItem(key);
  } catch {
    // O formulário continua funcional quando o navegador bloqueia o armazenamento.
  }
}
