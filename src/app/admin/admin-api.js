import { requestAccount } from "../account-api.js";
import { getAuthErrorMessage } from "../auth-api.js";
import { getAuthSession, updateAuthSessionUser } from "../auth-session.js";
import { numericId, resourceList, resourcePage } from "./_lib/admin-resources.js";
import { listAdminUsers, listAdminVehicles, listAdminTransfers } from "./operations-api.js";

function servicePath(identifier) {
  if (typeof identifier !== "string" || !identifier.trim())
    throw new Error("Tipo de serviço inválido.");
  return `/admin/service-types/${encodeURIComponent(identifier)}`;
}

function normalizeService(service) {
  if (
    !service ||
    typeof service.identifier !== "string" ||
    typeof service.name !== "string"
  ) {
    throw new Error(
      "O serviço retornou uma resposta inesperada. Tente novamente.",
    );
  }
  return { ...service, is_active: [true, 1, "1"].includes(service.is_active) };
}

export function getAdminFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fields = {};
  for (const [key, messages] of Object.entries(error?.data?.errors ?? {})) {
    const name = key.replace(/^fields\.0\./, "").split(".")[0];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (typeof message === "string" && !fields[name]) fields[name] = message;
  }
  return fields;
}

export function getAdminErrorMessage(error) {
  if (error?.status === 403)
    return "Sua conta não tem permissão para realizar esta operação.";
  if (error?.status === 404)
    return "Este registro não está mais disponível. Atualize a lista.";
  if (Object.keys(getAdminFieldErrors(error)).length)
    return "Confira os campos destacados e tente novamente.";
  return getAuthErrorMessage(
    error,
    "Não foi possível concluir a operação. Tente novamente.",
  );
}

export async function listInternalUsers({
  page = 1,
  search = "",
  searchBy = "name",
  sort = "name",
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: "15",
    sort,
  });
  if (search.trim())
    query.set(
      `filter[${searchBy === "email" ? "email" : "name"}]`,
      search.trim(),
    );
  const result = await requestAccount(`/admin/internal-users?${query}`, {
    method: "GET",
  });
  return resourcePage(result.data);
}

export async function getAdminOverview() {
  const [administrators, services, activeServices, users, vehicles, openTransfers] = await Promise.all([
    listInternalUsers(),
    listAdminServiceTypes(),
    listAdminServiceTypes({ status: "1" }),
    listAdminUsers(),
    listAdminVehicles(),
    listAdminTransfers({ filters: { status: "pending,expired" } }),
  ]);
  return {
    administrators: administrators.total,
    services: services.total,
    activeServices: activeServices.total,
    users: users.total,
    vehicles: vehicles.total,
    openTransfers: openTransfers.total,
  };
}

export async function saveInternalUser(id, payload) {
  const endpoint =
    id == null
      ? "/admin/internal-users"
      : `/admin/internal-users/${numericId(id)}`;
  const result = await requestAccount(endpoint, {
    method: id == null ? "POST" : "PATCH",
    payload,
  });
  const savedUser = result.data?.user ?? result.data;
  if (!Number.isInteger(savedUser?.id))
    throw new Error(
      "O serviço retornou uma resposta inesperada ao salvar a conta.",
    );
  if (getAuthSession()?.user.id === savedUser.id)
    updateAuthSessionUser(savedUser, result.sessionId);
  return savedUser;
}

export async function deleteInternalUser(id) {
  await requestAccount(`/admin/internal-users/${numericId(id)}`, {
    method: "DELETE",
  });
}

export async function listAdminServiceTypes({
  page = 1,
  search = "",
  status = "",
  sort = "name",
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    per_page: "15",
    sort,
  });
  if (search.trim()) query.set("filter[name]", search.trim());
  if (status !== "") query.set("filter[is_active]", status);
  const result = await requestAccount(`/admin/service-types?${query}`, {
    method: "GET",
  });
  const pageData = resourcePage(result.data);
  return { ...pageData, items: pageData.items.map(normalizeService) };
}

export async function getAdminServiceType(identifier) {
  const result = await requestAccount(servicePath(identifier), {
    method: "GET",
  });
  return normalizeService(result.data);
}

export async function saveAdminServiceType(identifier, payload) {
  const endpoint =
    identifier == null ? "/admin/service-types" : servicePath(identifier);
  const result = await requestAccount(endpoint, {
    method: identifier == null ? "POST" : "PATCH",
    payload,
  });
  return normalizeService(result.data);
}

export async function deleteAdminServiceType(identifier) {
  await requestAccount(servicePath(identifier), { method: "DELETE" });
}

export async function listServiceFields(identifier) {
  const result = await requestAccount(`${servicePath(identifier)}/fields`, {
    method: "GET",
  });
  return resourceList(result.data).toSorted(
    (first, second) => first.order - second.order,
  );
}

export async function saveServiceField(identifier, id, payload) {
  return requestAccount(`${servicePath(identifier)}/fields`, {
    method: id == null ? "POST" : "PUT",
    payload: {
      fields: [id == null ? payload : { id: numericId(id), ...payload }],
    },
  });
}

export async function setServiceFieldActive(identifier, id, active) {
  return requestAccount(
    `${servicePath(identifier)}/fields/${numericId(id)}/${active ? "enable" : "disable"}`,
    { method: "PATCH" },
  );
}
