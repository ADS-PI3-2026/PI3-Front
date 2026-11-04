const TRANSFER_PREFILL_KEY = "legadocar:vehicle-transfer-prefill:v1";

function getSessionStorage(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function saveVehicleTransferPrefill({ plate, renavam }, storage) {
  const normalizedPlate = String(plate ?? "").trim();
  const normalizedRenavam = String(renavam ?? "").replace(/\D/g, "").slice(0, 11);
  if (!normalizedPlate) return false;

  try {
    getSessionStorage(storage)?.setItem(TRANSFER_PREFILL_KEY, JSON.stringify({
      plate: normalizedPlate,
      renavam: normalizedRenavam,
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeVehicleTransferPrefill(storage) {
  const target = getSessionStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(TRANSFER_PREFILL_KEY);
    target.removeItem(TRANSFER_PREFILL_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    const plate = String(data?.plate ?? "").trim();
    if (!plate) return null;

    return {
      plate,
      renavam: String(data?.renavam ?? "").replace(/\D/g, "").slice(0, 11),
    };
  } catch {
    target.removeItem(TRANSFER_PREFILL_KEY);
    return null;
  }
}
