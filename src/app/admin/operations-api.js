import { requestAccount } from "../account-api.js";
import { numericId, resourcePage } from "./_lib/admin-resources.js";
import { getAdminFilterError } from "./_lib/admin-operations.js";

const resources = {
  users: { filters: ["name", "email", "document", "include_deleted", "created_at", "updated_at"], sorts: ["name", "email", "created_at", "updated_at", "vehicles_count"] },
  vehicles: { filters: ["user_id", "brand", "model", "plate", "year", "include_deleted", "created_at", "updated_at"], sorts: ["model", "brand", "year", "mileage", "created_at", "updated_at", "maintenances_count"] },
  transfers: { filters: ["status", "initiated_by", "vehicle_id", "current_owner_id", "recipient_id", "recipient_email", "plate", "created_at", "expires_at"], sorts: ["status", "initiated_by", "failed_attempts", "expires_at", "created_at", "updated_at"] },
  "audit-logs": { filters: ["user_id", "event", "auditable_id", "entity_type", "date_from", "date_to"], sorts: ["created_at", "event", "id"] },
};

function record(data, id) {
  if (!data || Array.isArray(data) || !Number.isInteger(data.id) || data.id < 1 || (id !== undefined && data.id !== id))
    throw new Error("O serviço retornou uma resposta inesperada. Tente novamente.");
  return data;
}

async function list(resource, { page = 1, sort = "-created_at", filters = {} } = {}, recoverPage = true) {
  const error = getAdminFilterError(filters);
  if (error) throw new Error(error);
  const allowed = resources[resource];
  if (!allowed.sorts.includes(sort.replace(/^-/, ""))) throw new Error("Ordenação inválida.");
  const query = new URLSearchParams({ page: String(numericId(page)), per_page: "15", sort });
  for (const key of allowed.filters) {
    let value = filters[key];
    if (value == null || value === false || String(value).trim() === "") continue;
    if (key === "include_deleted") value = "1";
    else if (key === "document") value = String(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
    else if (key === "plate") value = String(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
    query.set(`filter[${key}]`, String(value).trim());
  }
  const response = await requestAccount(`/admin/${resource}?${query}`, { method: "GET" });
  const result = resourcePage(response.data);
  if (result.page > result.lastPage) {
    if (recoverPage) return list(resource, { page: Math.max(1, result.lastPage), sort, filters }, false);
    throw new Error("A lista foi alterada durante a consulta. Atualize os dados e tente novamente.");
  }
  return { ...result, items: result.items.map(item => record(item)) };
}

async function detail(resource, id) {
  const value = numericId(id);
  const response = await requestAccount(`/admin/${resource}/${value}`, { method: "GET" });
  return record(response.data, value);
}

export const listAdminUsers = options => list("users", options);
export const getAdminUser = id => detail("users", id);
export const listAdminVehicles = options => list("vehicles", options);
export const getAdminVehicle = id => detail("vehicles", id);
export const listAdminTransfers = options => list("transfers", options);
export const getAdminTransfer = id => detail("transfers", id);
export const listAdminAuditLogs = options => list("audit-logs", options);
export const getAdminAuditLog = id => detail("audit-logs", id);

export async function completeAdminTransfer(id, renavam) {
  const value = numericId(id);
  const digits = typeof renavam === "string" ? renavam.replace(/\D/g, "") : "";
  if (!digits || digits.length > 20) throw new Error("Informe o RENAVAM do veículo para concluir a transferência.");
  const response = await requestAccount(`/admin/transfers/${value}/mediate-complete`, { method: "POST", payload: { renavam: digits } });
  const transfer = record(response.data, value);
  if (transfer.status !== "completed") throw new Error("Não foi possível confirmar a conclusão da transferência. Atualize os dados antes de tentar novamente.");
  return transfer;
}
