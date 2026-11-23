export const transferStatuses = [
  ["", "Todas as situações"], ["pending,expired", "Em aberto"], ["pending", "Pendentes"],
  ["expired", "Expiradas"], ["completed", "Concluídas"], ["cancelled", "Canceladas"],
];

export const transferStatusLabels = { pending: "Pendente", expired: "Expirada", completed: "Concluída", cancelled: "Cancelada" };
export const auditEventLabels = { created: "Cadastro", updated: "Alteração", soft_deleted: "Exclusão", deleted: "Exclusão definitiva", restored: "Restauração" };
export const auditEntities = [["", "Todas as entidades"], ["User", "Usuários"], ["Vehicle", "Veículos"], ["VehicleTransfer", "Transferências"], ["Maintenance", "Manutenções"], ["ServiceType", "Tipos de serviço"], ["ServiceTypeField", "Campos de serviço"], ["Setting", "Configurações"], ["InviteRequest", "Convites"]];

export function getMediationBlockReason(transfer, vehicle) {
  if (!transfer || !["pending", "expired"].includes(transfer.status)) return "Apenas transferências pendentes ou expiradas podem ser concluídas por mediação.";
  if (!transfer.recipient || transfer.recipient.deleted_at) return "O destinatário não está disponível. A transferência não pode ser concluída.";
  if (!transfer.vehicle || !vehicle) return "O veículo não está disponível para esta transferência.";
  if (vehicle.has_renavam === false) return "O veículo não possui RENAVAM cadastrado para validação.";
  if (vehicle.user_id === transfer.recipient.id) return "O destinatário já é o proprietário atual do veículo.";
  return "";
}

export function getMediationConfirmation(transfer) {
  const recipient = transfer.recipient;
  return `Confirmo a transferência de ${transfer.vehicle.plate} para ${recipient.name} (#${recipient.id} · ${recipient.email}).`;
}

function isDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getAdminFilterError(filters) {
  for (const key of ["user_id", "vehicle_id", "current_owner_id", "recipient_id", "auditable_id"]) {
    const value = filters[key];
    if (value == null || String(value).trim() === "") continue;
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) return "Informe um número de registro válido para filtrar.";
  }
  for (const key of ["date_from", "date_to"]) if (filters[key] && !isDay(filters[key])) return "Informe uma data válida para o período.";
  if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) return "A data inicial não pode ser posterior à data final.";
  return "";
}

export function parseAdminTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let normalized = value.trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += "T00:00:00";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) normalized += "Z";
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatAdminDateTime(value, timeZone) {
  const date = parseAdminTimestamp(value);
  return date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(date) + (timeZone === "UTC" ? " UTC" : "") : "—";
}

const protectedAuditFields = new Set(["renavam", "code", "password", "remember_token", "owner_otp_hash", "recipient_otp_hash"]);

export function getAuditChanges(before = {}, after = {}) {
  const previous = before && typeof before === "object" ? before : {};
  const next = after && typeof after === "object" ? after : {};
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].flatMap(key => {
    if (protectedAuditFields.has(key.toLowerCase())) return [];
    if (Object.hasOwn(previous, key) && Object.hasOwn(next, key) && JSON.stringify(previous[key]) === JSON.stringify(next[key])) return [];
    return [{ key, before: previous[key], after: next[key], kind: !Object.hasOwn(previous, key) ? "added" : !Object.hasOwn(next, key) ? "removed" : "changed" }];
  });
}

export function formatAuditValue(value) {
  if (value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
