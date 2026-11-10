import { getCachedAccountResponse, invalidateAccountReadCache, requestAccount } from "../../account-api.js";
import { getAuthErrorMessage } from "../../auth-api.js";

const vehicleTypeFolders = {
  car: "cars",
  motorcycle: "motorcycles",
  truck: "trucks",
};

const apiVehicleTypes = {
  cars: "car",
  motorcycles: "motorcycle",
  trucks: "truck",
};

const vehicleErrorFields = {
  type: "type",
  brand: "brand",
  brand_code: "brand",
  model: "model",
  year: "year",
  color: "color",
  plate: "plate",
  renavam: "renavam",
  mileage: "mileage",
};

const vehicleTransferErrorFields = {
  plate: "plate",
  renavam: "renavam",
  recipient_email: "recipient",
  code: "code",
};

const maintenanceErrorFields = {
  "maintenances.0.service_type_id": "category",
  "maintenances.0.description": "description",
  "maintenances.0.cost": "value",
  "maintenances.0.service_date": "date",
  "maintenances.0.mileage": "mileage",
};

const maintenanceAlertErrorFields = {
  title: "category",
  description: "description",
  service_type_id: "category",
  date_due: "date",
  mileage_due: "mileageDue",
};

function getVehicleList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  throw new Error("O serviço retornou uma resposta inesperada ao carregar seus veículos.");
}

function getResourceList(data, resourceName) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  throw new Error(`O serviço retornou uma resposta inesperada ao carregar ${resourceName}.`);
}

function getResourcePage(data, resourceName) {
  const items = getResourceList(data, resourceName);
  const currentPage = Number(data?.meta?.current_page);
  const lastPage = Number(data?.meta?.last_page);
  const total = Number(data?.meta?.total);
  const page = Number.isInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  const finalPage = Number.isInteger(lastPage) && lastPage >= page ? lastPage : page;

  return {
    hasMore: data?.links?.next != null || page < finalPage,
    items,
    page,
    total: Number.isInteger(total) && total >= 0 ? total : items.length,
  };
}

function getVehicleId(vehicleId) {
  const id = Number(vehicleId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Veículo não encontrado.");
    error.status = 404;
    throw error;
  }
  return id;
}

function getPositiveId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(message);
  return id;
}

function formatIdentifier(identifier) {
  const label = String(identifier ?? "").trim().replace(/[-_]+/g, " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

function normalizeServiceType(serviceType) {
  const identifier = typeof serviceType?.identifier === "string"
    ? serviceType.identifier.trim()
    : "";

  if (!identifier) {
    throw new Error("O serviço retornou um tipo de manutenção inválido.");
  }

  const id = Number(serviceType?.id);
  const name = typeof serviceType?.name === "string" && serviceType.name.trim()
    ? serviceType.name.trim()
    : formatIdentifier(identifier);

  return {
    description: typeof serviceType?.description === "string" ? serviceType.description.trim() : "",
    id: Number.isInteger(id) && id > 0 ? id : null,
    identifier,
    name,
  };
}

function normalizeServiceTypeField(field) {
  const id = Number(field?.id);
  const serviceTypeId = Number(field?.service_type_id);
  const name = typeof field?.name === "string" ? field.name.trim() : "";
  const label = typeof field?.display_name === "string" ? field.display_name.trim() : "";
  const type = typeof field?.field_type === "string" ? field.field_type.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !name || !label || !type) {
    throw new Error("O serviço retornou campos de manutenção inválidos.");
  }

  return {
    description: typeof field?.description === "string" ? field.description.trim() : "",
    id,
    label,
    name,
    options: Array.isArray(field?.options) ? field.options.map(String) : [],
    order: Number.isFinite(Number(field?.order)) ? Number(field.order) : 0,
    required: field?.required === true,
    requiredIfFieldFilled: typeof field?.required_if_field_filled === "string"
      ? field.required_if_field_filled
      : "",
    serviceTypeId: Number.isInteger(serviceTypeId) && serviceTypeId > 0 ? serviceTypeId : null,
    type,
  };
}

function parseMoney(value) {
  const normalized = String(value ?? "").trim().replace(/^R\$\s*/, "");
  if (!normalized) return NaN;
  const decimalValue = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  return Number(decimalValue);
}

function toApiDate(value) {
  const normalized = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function normalizePayloadValue(field, value) {
  if (field.type === "boolean") return value === true || value === "true";
  if (field.type === "checkbox") return Array.isArray(value) ? value : [];
  if (["number", "numeric", "decimal", "currency"].includes(field.type)) {
    const number = String(value ?? "").trim().replace(",", ".");
    return number === "" ? null : Number(number);
  }
  if (field.type === "integer") {
    const number = String(value ?? "").trim();
    return number === "" ? null : Number(number);
  }
  return String(value ?? "").trim() || null;
}

function formatApiDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data não informada";
}

function getLocalDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function summarizeMaintenanceAlertsByDate(alerts, referenceDate = getLocalDate()) {
  const validReferenceDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : getLocalDate();
  const pendingDates = alerts
    .filter((alert) => alert?.status === "pending")
    .map((alert) => alert?.date_due)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date ?? "")));
  const upcomingDates = pendingDates
    .filter((date) => date >= validReferenceDate)
    .sort();
  const nextDate = upcomingDates[0] ?? "";

  return {
    nextDate,
    nextDateLabel: nextDate ? formatApiDate(nextDate) : "",
    overdueCount: pendingDates.filter((date) => date < validReferenceDate).length,
  };
}

function formatServiceType(serviceType) {
  const value = typeof serviceType === "string"
    ? serviceType
    : serviceType?.name ?? serviceType?.description ?? serviceType?.identifier ?? "";
  const label = String(value).trim().replace(/[-_]+/g, " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Manutenção";
}

function isAlertOverdue(alert, currentMileage) {
  if (alert?.status !== "pending") return false;

  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const dateOverdue = /^\d{4}-\d{2}-\d{2}$/.test(alert?.date_due)
    && alert.date_due < localDate;
  const mileageDue = Number(alert?.mileage_due);
  const mileageOverdue = alert?.mileage_due != null
    && Number.isFinite(mileageDue)
    && Number.isFinite(currentMileage)
    && mileageDue <= currentMileage;

  return dateOverdue || mileageOverdue;
}

function formatAlertDeadline(alert) {
  const deadlines = [];
  if (alert?.date_due) deadlines.push(formatApiDate(alert.date_due));
  if (alert?.mileage_due != null && Number.isFinite(Number(alert.mileage_due))) {
    deadlines.push(`${new Intl.NumberFormat("pt-BR").format(Number(alert.mileage_due))} km`);
  }
  return deadlines.join(" ou ") || "Prazo não informado";
}

export function normalizeVehicle(vehicle) {
  const id = Number(vehicle?.id);
  const mileage = Number(vehicle?.mileage);
  const brand = typeof vehicle?.brand === "string" ? vehicle.brand.trim() : "";
  const color = typeof vehicle?.color === "string" ? vehicle.color.trim() : "";
  const model = typeof vehicle?.model === "string" ? vehicle.model.trim() : "";
  const plate = typeof vehicle?.plate === "string" ? vehicle.plate.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !brand || !model || !plate || !Number.isFinite(mileage)) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar seus veículos.");
  }

  return {
    id,
    brand,
    brandId: vehicle?.brand_code == null ? "" : String(vehicle.brand_code),
    color,
    createdAt: typeof vehicle?.created_at === "string" ? vehicle.created_at : "",
    mileage,
    model,
    name: `${brand} ${model}`,
    plate,
    type: vehicleTypeFolders[vehicle?.type] ?? "cars",
    version: vehicle?.year ? `Ano ${vehicle.year}` : "Ano não informado",
    year: vehicle?.year ?? null,
  };
}

function normalizeVehicleTransfer(transfer) {
  const id = Number(transfer?.transfer_id ?? transfer?.id);
  const vehicleId = Number(transfer?.vehicle_id ?? transfer?.vehicle?.id);
  const status = typeof transfer?.status === "string" ? transfer.status.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(vehicleId) || vehicleId <= 0 || !status) {
    throw new Error("O serviço retornou uma transferência inválida.");
  }

  const vehicle = transfer?.vehicle && typeof transfer.vehicle === "object"
    ? {
        id: vehicleId,
        model: typeof transfer.vehicle.model === "string" ? transfer.vehicle.model.trim() : "",
        plate: typeof transfer.vehicle.plate === "string" ? transfer.vehicle.plate.trim() : "",
      }
    : null;
  const counterpartId = Number(transfer?.counterpart?.id);
  const counterpart = transfer?.counterpart && typeof transfer.counterpart === "object"
    ? {
        email: typeof transfer.counterpart.email === "string" ? transfer.counterpart.email.trim() : "",
        id: Number.isInteger(counterpartId) && counterpartId > 0 ? counterpartId : null,
        name: typeof transfer.counterpart.name === "string" ? transfer.counterpart.name.trim() : "",
      }
    : null;

  return {
    counterpart,
    createdAt: typeof transfer?.created_at === "string" ? transfer.created_at : "",
    id,
    initiatedBy: typeof transfer?.initiated_by === "string" ? transfer.initiated_by : "",
    expiresAt: typeof transfer?.expires_at === "string" ? transfer.expires_at : "",
    ownerValidated: Boolean(transfer?.owner_validated),
    recipientValidated: Boolean(transfer?.recipient_validated),
    role: ["owner", "recipient"].includes(transfer?.role) ? transfer.role : "",
    status,
    vehicle,
    vehicleId,
  };
}

export function normalizeMaintenance(maintenance) {
  const id = Number(maintenance?.id);
  const mileage = Number(maintenance?.mileage);

  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(mileage)) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar o histórico de manutenções.");
  }

  const serviceType = formatServiceType(maintenance.service_type);
  const firstAttachment = Array.isArray(maintenance?.attachments)
    ? maintenance.attachments[0]
    : null;

  return {
    attachment: firstAttachment?.original_name ?? "",
    category: serviceType,
    date: formatApiDate(maintenance.service_date),
    description: typeof maintenance?.description === "string" ? maintenance.description : "",
    id,
    mileage,
    readonly: maintenance?.is_author === false,
    status: "Realizada",
    title: serviceType,
    value: maintenance?.cost ?? null,
  };
}

export function normalizeMaintenanceExpense(maintenance) {
  const id = Number(maintenance?.id);
  const cost = Number(maintenance?.cost);
  const vehicleId = Number(maintenance?.vehicle_id);
  const serviceDate = typeof maintenance?.service_date === "string"
    ? maintenance.service_date.slice(0, 10)
    : "";

  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(cost) || cost < 0
    || !Number.isInteger(vehicleId) || vehicleId <= 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    throw new Error("O serviço retornou despesas de manutenção inválidas.");
  }

  return {
    category: formatServiceType(maintenance?.service_type),
    cost,
    id,
    serviceDate,
    vehicleId,
  };
}

function normalizeMaintenanceAttachment(attachment) {
  const id = Number(attachment?.id);
  const name = typeof attachment?.original_name === "string"
    ? attachment.original_name.trim()
    : "";
  const size = Number(attachment?.file_size);

  if (!Number.isInteger(id) || id <= 0 || !name) {
    throw new Error("O serviço retornou um comprovante inválido.");
  }

  return {
    canDownload: attachment?.can_download === true,
    id,
    mimeType: typeof attachment?.mime_type === "string" ? attachment.mime_type : "",
    name,
    size: Number.isFinite(size) && size >= 0 ? size : null,
  };
}

export function normalizeMaintenanceDetail(maintenance) {
  const id = Number(maintenance?.id);
  const vehicleId = Number(maintenance?.vehicle_id);
  const mileage = Number(maintenance?.mileage);
  const cost = Number(maintenance?.cost);
  const serviceTypeId = Number(maintenance?.service_type?.id);
  const identifier = typeof maintenance?.service_type?.identifier === "string"
    ? maintenance.service_type.identifier.trim()
    : "";
  const category = formatServiceType(maintenance?.service_type);

  if (
    !Number.isInteger(id) || id <= 0
    || !Number.isInteger(vehicleId) || vehicleId <= 0
    || !Number.isFinite(mileage)
    || !Number.isFinite(cost)
    || !identifier
  ) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar a manutenção.");
  }

  const payload = maintenance?.payload;
  const vehicle = maintenance?.vehicle;

  return {
    attachments: Array.isArray(maintenance?.attachments)
      ? maintenance.attachments.map(normalizeMaintenanceAttachment)
      : [],
    category,
    cost,
    date: formatApiDate(maintenance.service_date),
    description: typeof maintenance?.description === "string" ? maintenance.description.trim() : "",
    id,
    mileage,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
    readonly: maintenance?.is_author !== true,
    registeredBy: typeof maintenance?.registered_by === "string"
      ? maintenance.registered_by.trim()
      : "",
    serviceDate: typeof maintenance?.service_date === "string" ? maintenance.service_date : "",
    serviceType: {
      id: Number.isInteger(serviceTypeId) && serviceTypeId > 0 ? serviceTypeId : null,
      identifier,
      name: category,
    },
    vehicle: {
      id: Number(vehicle?.id) || vehicleId,
      model: typeof vehicle?.model === "string" ? vehicle.model.trim() : "",
      plate: typeof vehicle?.plate === "string" ? vehicle.plate.trim() : "",
    },
    vehicleId,
  };
}

export function normalizeMaintenanceAlert(alert, currentMileage) {
  const id = Number(alert?.id);
  const title = typeof alert?.title === "string" ? alert.title.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !title) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar os alertas de manutenção.");
  }

  return {
    category: formatServiceType(alert.service_type),
    date: formatAlertDeadline(alert),
    description: typeof alert?.description === "string" && alert.description.trim()
      ? alert.description.trim()
      : "Alerta programado para este veículo.",
    id,
    status: isAlertOverdue(alert, Number(currentMileage)) ? "Atrasada" : "A realizar",
    title,
  };
}

export function normalizeMaintenanceAlertDetail(alert) {
  const id = Number(alert?.id);
  const vehicleId = Number(alert?.vehicle_id);
  const userId = Number(alert?.user_id);
  const serviceTypeId = Number(alert?.service_type_id ?? alert?.service_type?.id);
  const title = typeof alert?.title === "string" ? alert.title.trim() : "";
  const description = typeof alert?.description === "string" ? alert.description.trim() : "";
  const status = typeof alert?.status === "string" ? alert.status : "";

  if (
    !Number.isInteger(id) || id <= 0
    || !Number.isInteger(vehicleId) || vehicleId <= 0
    || !Number.isInteger(userId) || userId <= 0
    || !Number.isInteger(serviceTypeId) || serviceTypeId <= 0
    || !title || !description
    || !["pending", "completed", "cancelled"].includes(status)
  ) {
    throw new Error("O serviço retornou uma resposta inesperada ao carregar o alerta.");
  }

  return {
    dateDue: typeof alert?.date_due === "string" ? alert.date_due : "",
    description,
    id,
    mileageDue: alert?.mileage_due == null ? null : Number(alert.mileage_due),
    serviceType: {
      id: serviceTypeId,
      name: formatServiceType(alert?.service_type),
    },
    serviceTypeId,
    status,
    title,
    userId,
    vehicle: {
      id: Number(alert?.vehicle?.id) || vehicleId,
      mileage: Number(alert?.vehicle?.mileage),
      plate: typeof alert?.vehicle?.plate === "string" ? alert.vehicle.plate.trim() : "",
    },
    vehicleId,
  };
}

export function buildVehiclePayload({ form, brand, model, year }) {
  const apiType = apiVehicleTypes[form.type];
  const yearMatch = `${year?.name ?? ""} ${year?.code ?? ""}`.match(/\b\d{4}\b/);
  const yearNumber = yearMatch ? Number(yearMatch[0]) : NaN;
  const renavam = form.renavam.replace(/\D/g, "");

  if (!apiType || !brand?.code || !brand?.name || !model?.name || !Number.isInteger(yearNumber)) {
    throw new Error("Selecione novamente o tipo, a marca, o ano e o modelo do veículo.");
  }

  return {
    type: apiType,
    brand: brand.name.trim(),
    brand_code: String(brand.code),
    model: model.name.trim(),
    year: yearNumber,
    mileage: Number(form.mileage),
    color: form.color.trim(),
    plate: form.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    renavam: renavam.length === 9 ? `00${renavam}` : renavam,
  };
}

export function buildBuyerTransferPayload(form) {
  const renavam = String(form.renavam ?? "").replace(/\D/g, "");
  return {
    plate: String(form.plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    renavam: renavam.length === 9 ? `00${renavam}` : renavam,
  };
}

export function getVehicleFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fieldErrors = {};

  for (const [field, messages] of Object.entries(error?.data?.errors ?? {})) {
    const formField = vehicleErrorFields[field];
    const message = Array.isArray(messages) ? messages[0] : null;
    if (formField && typeof message === "string" && !fieldErrors[formField]) {
      fieldErrors[formField] = message;
    }
  }

  return fieldErrors;
}

export function getVehicleErrorMessage(error, fallback) {
  if (Object.keys(getVehicleFieldErrors(error)).length > 0) {
    return "Confira os campos destacados e tente novamente.";
  }
  return getAuthErrorMessage(error, fallback);
}

export function getVehicleTransferSuggestion(error) {
  const details = error?.data?.errors;
  if (error?.status !== 422 || details?.can_transfer !== true) return null;

  const vehicleId = Number(details.vehicle_id);
  return {
    model: typeof details.model === "string" ? details.model.trim() : "",
    ownerHint: typeof details.owner_hint === "string" ? details.owner_hint.trim() : "",
    plate: typeof details.plate === "string" ? details.plate.trim() : "",
    vehicleId: Number.isInteger(vehicleId) && vehicleId > 0 ? vehicleId : null,
  };
}

export function getVehicleTransferFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fieldErrors = {};

  for (const [field, messages] of Object.entries(error?.data?.errors ?? {})) {
    const formField = vehicleTransferErrorFields[field];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (formField && typeof message === "string" && !fieldErrors[formField]) {
      fieldErrors[formField] = message;
    }
  }

  return fieldErrors;
}

export function getVehicleTransferErrorMessage(error, fallback) {
  if (Object.keys(getVehicleTransferFieldErrors(error)).length > 0) {
    return "Confira os campos destacados e tente novamente.";
  }
  return getAuthErrorMessage(error, fallback);
}

export function buildMaintenancePayload({ vehicleId, form, serviceType, fields, fieldValues }) {
  const id = getVehicleId(vehicleId);
  const serviceTypeId = getPositiveId(
    serviceType?.id ?? fields.find((field) => field.serviceTypeId)?.serviceTypeId,
    "Não foi possível identificar o tipo de serviço. Selecione a categoria novamente.",
  );
  const payload = {};

  for (const field of fields) {
    const value = normalizePayloadValue(field, fieldValues[field.name]);
    if (value !== null && (!Array.isArray(value) || value.length > 0)) payload[field.name] = value;
  }

  return {
    vehicle_id: id,
    maintenances: [{
      service_type_id: serviceTypeId,
      description: String(form.description ?? "").trim() || null,
      cost: parseMoney(form.value),
      service_date: toApiDate(form.date),
      mileage: Number(form.mileage),
      payload,
    }],
  };
}

export function buildMaintenanceAlertPayload({ form, serviceType, fields }) {
  const serviceTypeId = getPositiveId(
    serviceType?.id ?? fields.find((field) => field.serviceTypeId)?.serviceTypeId,
    "Não foi possível identificar o tipo de serviço. Selecione a categoria novamente.",
  );
  const title = typeof serviceType?.name === "string" ? serviceType.name.trim() : "";

  if (!title) throw new Error("Selecione novamente a categoria do alerta.");

  return {
    title,
    description: String(form.description ?? "").trim(),
    service_type_id: serviceTypeId,
    date_due: String(form.date ?? "").trim() ? toApiDate(form.date) : null,
    mileage_due: String(form.mileageDue ?? "").trim()
      ? Number(form.mileageDue)
      : null,
  };
}

export function getMaintenanceFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fieldErrors = {};

  for (const [field, messages] of Object.entries(error?.data?.errors ?? {})) {
    const dynamicMatch = /^maintenances\.0\.payload\.(.+)$/.exec(field);
    const formField = dynamicMatch ? `payload.${dynamicMatch[1]}` : maintenanceErrorFields[field];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (formField && typeof message === "string" && !fieldErrors[formField]) {
      fieldErrors[formField] = message;
    }
  }

  return fieldErrors;
}

export function getMaintenanceErrorMessage(error, fallback) {
  if (Object.keys(getMaintenanceFieldErrors(error)).length > 0) {
    return "Confira os campos destacados e tente novamente.";
  }
  return getAuthErrorMessage(error, fallback);
}

export function getMaintenanceAlertFieldErrors(error) {
  if (error?.status >= 500) return {};
  const fieldErrors = {};

  for (const [field, messages] of Object.entries(error?.data?.errors ?? {})) {
    const formField = maintenanceAlertErrorFields[field];
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (formField && typeof message === "string" && !fieldErrors[formField]) {
      fieldErrors[formField] = message;
    }
  }

  return fieldErrors;
}

export function getMaintenanceAlertErrorMessage(error, fallback) {
  if (Object.keys(getMaintenanceAlertFieldErrors(error)).length > 0) {
    return "Confira os campos destacados e tente novamente.";
  }
  return getAuthErrorMessage(error, fallback);
}

export function getCachedVehicles() {
  const result = getCachedAccountResponse("/vehicles", { allowStale: true });
  if (!result) return null;
  try {
    return getVehicleList(result.data).map(normalizeVehicle);
  } catch {
    invalidateAccountReadCache();
    return null;
  }
}

export function getCachedVehiclePage() {
  const result = getCachedAccountResponse("/vehicles?per_page=15&page=1", { allowStale: true });
  if (!result) return null;
  try {
    const page = getResourcePage(result.data, "seus veículos");
    return { ...page, items: page.items.map(normalizeVehicle) };
  } catch {
    invalidateAccountReadCache();
    return null;
  }
}

export async function listVehicles() {
  const result = await requestAccount("/vehicles", { method: "GET", cacheForMs: 30000 });
  try {
    return getVehicleList(result.data).map(normalizeVehicle);
  } catch (error) {
    invalidateAccountReadCache();
    throw error;
  }
}

export async function listVehiclePage(page = 1) {
  const pageNumber = getPositiveId(page, "Página de veículos inválida.");
  const endpoint = `/vehicles?per_page=15&page=${pageNumber}`;
  const result = await requestAccount(endpoint, {
    method: "GET",
    cacheForMs: pageNumber === 1 ? 30000 : 0,
  });
  try {
    const resourcePage = getResourcePage(result.data, "seus veículos");
    return { ...resourcePage, items: resourcePage.items.map(normalizeVehicle) };
  } catch (error) {
    invalidateAccountReadCache();
    throw error;
  }
}

export async function getVehicle(vehicleId) {
  const id = getVehicleId(vehicleId);
  const result = await requestAccount(`/vehicles/${id}`, { method: "GET" });
  return normalizeVehicle(result.data);
}

export async function updateVehicle(vehicleId, payload) {
  const id = getVehicleId(vehicleId);
  const result = await requestAccount(`/vehicles/${id}`, {
    method: "PATCH",
    payload,
  });
  return normalizeVehicle(result.data);
}

export async function requestVehiclePlateChangeCode() {
  return requestAccount("/otp/request", {
    payload: { purpose: "change_plate_type" },
  });
}

export async function validateVehiclePlateChangeCode(code) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Digite os seis números enviados para o seu e-mail.");
  }

  const result = await requestAccount("/otp/validate", {
    payload: { purpose: "change_plate_type", code },
  });
  const actionToken = result.data?.action_token;

  if (typeof actionToken !== "string" || !actionToken.trim()) {
    throw new Error("Não foi possível confirmar sua identidade. Solicite um novo código.");
  }

  return actionToken;
}

export async function changeVehiclePlateType(vehicleId, actionToken) {
  const id = getVehicleId(vehicleId);
  if (typeof actionToken !== "string" || !actionToken.trim()) {
    throw new Error("Solicite um novo código de confirmação antes de alterar a placa.");
  }

  return requestAccount(`/vehicles/${id}/change-plate`, {
    method: "POST",
    actionToken,
  });
}

export async function requestVehicleDeletionCode() {
  return requestAccount("/otp/request", {
    payload: { purpose: "vehicle_deletion" },
  });
}

export async function validateVehicleDeletionCode(code) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Digite os seis números enviados para o seu e-mail.");
  }

  const result = await requestAccount("/otp/validate", {
    payload: { purpose: "vehicle_deletion", code },
  });
  const actionToken = result.data?.action_token;

  if (typeof actionToken !== "string" || !actionToken.trim()) {
    throw new Error("Não foi possível confirmar sua identidade. Solicite um novo código.");
  }

  return actionToken;
}

export async function deleteVehicle(vehicleId, actionToken) {
  const id = getVehicleId(vehicleId);
  if (typeof actionToken !== "string" || !actionToken.trim()) {
    throw new Error("Solicite um novo código de confirmação antes de remover o veículo.");
  }

  return requestAccount(`/vehicles/${id}`, {
    method: "DELETE",
    actionToken,
  });
}

export async function getMaintenance(maintenanceId) {
  const id = getPositiveId(maintenanceId, "Manutenção não encontrada.");
  const result = await requestAccount(`/maintenances/${id}`, { method: "GET" });
  return normalizeMaintenanceDetail(result.data);
}

export async function listVehicleMaintenances(vehicleId) {
  const id = getVehicleId(vehicleId);
  const result = await requestAccount(`/vehicles/${id}/maintenances`, { method: "GET" });
  const records = getResourceList(result.data, "o histórico de manutenções");
  return enrichMaintenanceAuthorship(records);
}

async function enrichMaintenanceAuthorship(records) {
  return Promise.all(records.map(async (record) => {
    const maintenance = normalizeMaintenance(record);
    if (typeof record?.is_author === "boolean") return maintenance;

    try {
      const detail = await getMaintenance(maintenance.id);
      return { ...maintenance, readonly: detail.readonly };
    } catch {
      return { ...maintenance, readonly: true };
    }
  }));
}

export async function listVehicleMaintenancesPage(vehicleId, page = 1) {
  const id = getVehicleId(vehicleId);
  const pageNumber = getPositiveId(page, "Página do histórico inválida.");
  const result = await requestAccount(
    `/vehicles/${id}/maintenances?per_page=15&page=${pageNumber}`,
    { method: "GET" },
  );
  const resourcePage = getResourcePage(result.data, "o histórico de manutenções");
  return {
    ...resourcePage,
    items: await enrichMaintenanceAuthorship(resourcePage.items),
  };
}

export async function listVehicleMaintenanceDetails(vehicleId) {
  const id = getVehicleId(vehicleId);
  const maintenances = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await requestAccount(
      `/vehicles/${id}/maintenances?per_page=15&page=${page}`,
      { method: "GET" },
    );
    const resourcePage = getResourcePage(result.data, "o histórico de manutenções");
    const details = await Promise.all(resourcePage.items.map((record) => {
      const maintenanceId = getPositiveId(record?.id, "Manutenção não encontrada.");
      return getMaintenance(maintenanceId);
    }));

    maintenances.push(...details);
    hasMore = resourcePage.hasMore;
    page = resourcePage.page + 1;
  }

  return maintenances;
}

export async function listMaintenanceExpenses() {
  const expenses = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await requestAccount(`/maintenances?per_page=15&page=${page}`, {
      method: "GET",
      cacheForMs: page === 1 ? 30000 : 0,
    });
    const expensePage = getResourcePage(result.data, "suas despesas de manutenção");
    expenses.push(...expensePage.items.map(normalizeMaintenanceExpense));
    hasMore = expensePage.hasMore;
    page = expensePage.page + 1;
  }

  return expenses;
}

export async function listVehicleAlerts(vehicleId, currentMileage) {
  const id = getVehicleId(vehicleId);
  const result = await requestAccount(
    `/vehicles/${id}/maintenance-alerts?filter%5Bstatus%5D=pending`,
    { method: "GET" },
  );
  return getResourceList(result.data, "os alertas de manutenção")
    .map((alert) => normalizeMaintenanceAlert(alert, currentMileage));
}

export async function listVehicleAlertsPage(vehicleId, currentMileage, page = 1) {
  const id = getVehicleId(vehicleId);
  const pageNumber = getPositiveId(page, "Página de alertas inválida.");
  const result = await requestAccount(
    `/vehicles/${id}/maintenance-alerts?filter%5Bstatus%5D=pending&per_page=15&page=${pageNumber}`,
    { method: "GET" },
  );
  const resourcePage = getResourcePage(result.data, "os alertas de manutenção");
  return {
    ...resourcePage,
    items: resourcePage.items.map((alert) => normalizeMaintenanceAlert(alert, currentMileage)),
  };
}

export async function getVehicleMaintenanceDateSummary(vehicleId, referenceDate) {
  const id = getVehicleId(vehicleId);
  const alerts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await requestAccount(
      `/vehicles/${id}/maintenance-alerts?filter%5Bstatus%5D=pending&per_page=15&page=${page}`,
      { method: "GET", cacheForMs: 30000 },
    );
    const resourcePage = getResourcePage(result.data, "os alertas de manutenção");
    alerts.push(...resourcePage.items);
    hasMore = resourcePage.hasMore;
    page = resourcePage.page + 1;
  }

  return summarizeMaintenanceAlertsByDate(alerts, referenceDate);
}

export async function createVehicle(payload) {
  const result = await requestAccount("/vehicles", { method: "POST", payload });
  return normalizeVehicle(result.data);
}

export async function startVehicleTransferByBuyer(payload) {
  const result = await requestAccount("/transfers/start-by-buyer", {
    method: "POST",
    payload,
  });
  return normalizeVehicleTransfer(result.data);
}

export async function startVehicleTransferByOwner(vehicleId, recipientEmail) {
  const id = getVehicleId(vehicleId);
  const email = String(recipientEmail ?? "").trim().toLowerCase();
  if (!email) throw new Error("Informe o e-mail do novo proprietário.");

  const result = await requestAccount(`/vehicles/${id}/transfers`, {
    method: "POST",
    payload: { recipient_email: email },
  });
  return normalizeVehicleTransfer(result.data);
}

export async function getVehicleTransfer(transferId) {
  const id = getPositiveId(transferId, "Transferência não encontrada.");
  const result = await requestAccount(`/transfers/${id}`, { method: "GET" });
  return normalizeVehicleTransfer(result.data);
}

export async function listVehicleTransferPage(page = 1, { status = "pending", vehicleId = null } = {}) {
  const pageNumber = getPositiveId(page, "Página de transferências inválida.");
  const params = new URLSearchParams();
  if (status) params.set("filter[status]", String(status));
  if (vehicleId != null) {
    params.set("filter[vehicle_id]", String(getVehicleId(vehicleId)));
  }
  params.set("per_page", "15");
  params.set("page", String(pageNumber));

  const result = await requestAccount(`/transfers?${params.toString()}`, { method: "GET" });
  const resourcePage = getResourcePage(result.data, "suas transferências");
  return {
    ...resourcePage,
    items: resourcePage.items.map(normalizeVehicleTransfer),
  };
}

export async function cancelVehicleTransfer(transferId) {
  const id = getPositiveId(transferId, "Transferência não encontrada.");
  await requestAccount(`/transfers/${id}`, { method: "DELETE" });
}

export async function validateVehicleTransferCode(code) {
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Digite os seis números do código de confirmação.");
  }

  const result = await requestAccount("/transfers/validate", {
    method: "POST",
    payload: { code },
  });
  const data = result.data;
  const id = Number(data?.transfer_id);
  const status = typeof data?.status === "string" ? data.status.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !status) {
    throw new Error("O serviço retornou uma confirmação de transferência inválida.");
  }

  return {
    id,
    ownerValidated: Boolean(data.owner_validated),
    recipientValidated: Boolean(data.recipient_validated),
    status,
  };
}

export async function listServiceTypes() {
  const result = await requestAccount("/service-types?per_page=15", { method: "GET" });
  return getResourceList(result.data, "os tipos de serviço").map(normalizeServiceType);
}

export async function getServiceTypeFields(identifier) {
  const value = String(identifier ?? "").trim();
  if (!value) throw new Error("Selecione um tipo de serviço.");
  const result = await requestAccount(
    `/service-types/${encodeURIComponent(value)}/fields`,
    { method: "GET" },
  );
  return getResourceList(result.data, "os campos do tipo de serviço")
    .map(normalizeServiceTypeField)
    .sort((first, second) => first.order - second.order);
}

export async function resolveServiceTypeIds(serviceTypes) {
  return Promise.all(serviceTypes.map(async (serviceType) => {
    if (Number.isInteger(serviceType.id) && serviceType.id > 0) return serviceType;
    const fields = await getServiceTypeFields(serviceType.identifier);
    const id = getPositiveId(
      fields.find((field) => field.serviceTypeId)?.serviceTypeId,
      `O tipo de serviço ${serviceType.name} não possui um identificador válido.`,
    );
    return { ...serviceType, id };
  }));
}

export async function createMaintenance(payload) {
  const result = await requestAccount("/maintenances", { method: "POST", payload });
  const maintenances = getResourceList(result.data, "as manutenções cadastradas");
  return maintenances;
}

export async function createMaintenanceAlert(vehicleId, payload) {
  const id = getVehicleId(vehicleId);
  const result = await requestAccount(`/vehicles/${id}/maintenance-alerts`, {
    method: "POST",
    payload,
  });
  return result.data;
}

export async function getMaintenanceAlert(vehicleId, alertId) {
  const vehicle = getVehicleId(vehicleId);
  const alert = getPositiveId(alertId, "Alerta não encontrado.");
  const result = await requestAccount(
    `/vehicles/${vehicle}/maintenance-alerts/${alert}`,
    { method: "GET" },
  );
  return normalizeMaintenanceAlertDetail(result.data);
}

export async function updateMaintenanceAlert(vehicleId, alertId, payload) {
  const vehicle = getVehicleId(vehicleId);
  const alert = getPositiveId(alertId, "Alerta não encontrado.");
  const result = await requestAccount(
    `/vehicles/${vehicle}/maintenance-alerts/${alert}`,
    { method: "PATCH", payload },
  );
  return normalizeMaintenanceAlertDetail(result.data);
}

export async function uploadMaintenanceAttachments(maintenanceId, files) {
  const id = getPositiveId(maintenanceId, "Manutenção não encontrada.");
  const formData = new FormData();
  for (const file of files) formData.append("files[]", file);
  return requestAccount(`/maintenances/${id}/attachments`, {
    method: "POST",
    formData,
  });
}

export async function downloadMaintenanceAttachment(attachmentId) {
  const id = getPositiveId(attachmentId, "Comprovante não encontrado.");
  const result = await requestAccount(`/maintenances/attachments/${id}/download`, {
    method: "GET",
    responseType: "blob",
  });
  return result.data;
}

export async function deleteMaintenanceAttachment(attachmentId) {
  const id = getPositiveId(attachmentId, "Comprovante não encontrado.");
  return requestAccount(`/maintenances/attachments/${id}`, { method: "DELETE" });
}
