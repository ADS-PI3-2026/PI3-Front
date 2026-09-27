export const TRANSFER_CONFIRMATION_WINDOW_HOURS = 24;

const STORAGE_KEY_PREFIX = "legado-car-transfer";

function getStorageKey(vehicleId) {
  return `${STORAGE_KEY_PREFIX}:${vehicleId}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function createPreviewTransfer({ recipientDisplay, vehicleId }) {
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + TRANSFER_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000,
  );

  return {
    buyerStatus: "pending",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    id: `preview-${vehicleId}-${createdAt.getTime()}`,
    recipientDisplay,
    sellerStatus: "pending",
    status: "pending",
    vehicleId: String(vehicleId),
  };
}

export function savePreviewTransfer(transfer) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(getStorageKey(transfer.vehicleId), JSON.stringify(transfer));
}

export function getPreviewTransfer(vehicleId) {
  if (!canUseLocalStorage()) return null;

  const storedTransfer = window.localStorage.getItem(getStorageKey(vehicleId));
  if (!storedTransfer) return null;

  try {
    const transfer = JSON.parse(storedTransfer);
    const expired = new Date(transfer.expiresAt).getTime() <= Date.now();

    if (expired && transfer.status !== "completed") {
      const expiredTransfer = { ...transfer, status: "expired" };
      savePreviewTransfer(expiredTransfer);
      return expiredTransfer;
    }

    return transfer;
  } catch {
    window.localStorage.removeItem(getStorageKey(vehicleId));
    return null;
  }
}

export function removePreviewTransfer(vehicleId) {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(getStorageKey(vehicleId));
}

export function confirmPreviewTransferParticipant(transfer, participant) {
  const nextTransfer = {
    ...transfer,
    [`${participant}Status`]: "confirmed",
  };

  nextTransfer.status = nextTransfer.buyerStatus === "confirmed"
    && nextTransfer.sellerStatus === "confirmed"
    ? "completed"
    : "pending";

  savePreviewTransfer(nextTransfer);
  return nextTransfer;
}
