import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { installStorage, startSession, success } from "./helpers/session-fixture.js";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
const originalWindow = globalThis.window;

beforeEach(() => {
  installStorage();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalUrl;
});

async function garageApi() {
  return import("../src/app/garagem/_lib/garage-api.js");
}

test("lista os veículos da conta com o JWT da sessão", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/vehicles");
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    return success([
      {
        id: 7,
        brand: "Toyota",
        brand_code: "56",
        model: "Corolla XEi 2.0",
        year: 2024,
        plate: "ABC1D23",
        mileage: 12500,
        type: "car",
      },
    ]);
  };

  const vehicles = await (await garageApi()).listVehicles();

  assert.deepEqual(vehicles, [
    {
      id: 7,
      brand: "Toyota",
      brandId: "56",
      mileage: 12500,
      model: "Corolla XEi 2.0",
      name: "Toyota Corolla XEi 2.0",
      plate: "ABC1D23",
      type: "cars",
      version: "Ano 2024",
      year: 2024,
    },
  ]);
});

test("aceita a paginação aninhada atual e usa o ícone genérico sem os campos pendentes", async () => {
  startSession();
  globalThis.fetch = async () => success({
    data: [{ id: 8, brand: "Honda", model: "HR-V", year: 2020, plate: "BRA1234", mileage: 50000 }],
    links: {},
    meta: {},
  });

  const [vehicle] = await (await garageApi()).listVehicles();

  assert.equal(vehicle.brandId, "");
  assert.equal(vehicle.type, "cars");
});

test("recusa uma resposta de veículos fora do contrato esperado", async () => {
  startSession();
  globalThis.fetch = async () => success({ items: [] });

  await assert.rejects(
    (await garageApi()).listVehicles(),
    /resposta inesperada ao carregar seus veículos/,
  );
});

test("carrega os dados de um veículo pelo identificador", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/vehicles/7");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    return success({
      id: 7,
      brand: "Toyota",
      brand_code: "56",
      model: "Corolla XEi 2.0",
      year: 2024,
      plate: "ABC1D23",
      mileage: 12500,
      type: "car",
    });
  };

  const vehicle = await (await garageApi()).getVehicle("7");

  assert.equal(vehicle.name, "Toyota Corolla XEi 2.0");
  assert.equal(vehicle.brandId, "56");
});

test("atualiza a quilometragem do veículo e normaliza a resposta", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/vehicles/7");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    assert.deepEqual(JSON.parse(options.body), { mileage: 13500 });
    return success({
      id: 7,
      brand: "Toyota",
      brand_code: "56",
      model: "Corolla XEi 2.0",
      year: 2024,
      plate: "ABC1D23",
      mileage: 13500,
      type: "car",
    });
  };

  const vehicle = await (await garageApi()).updateVehicle(7, { mileage: 13500 });

  assert.equal(vehicle.mileage, 13500);
  assert.equal(vehicle.name, "Toyota Corolla XEi 2.0");
});

test("solicita e valida o OTP antes de converter a placa do veículo", async () => {
  const session = startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return success(url.endsWith("/otp/validate")
      ? { action_token: "confirmacao-da-placa" }
      : null);
  };

  const {
    changeVehiclePlateType,
    requestVehiclePlateChangeCode,
    validateVehiclePlateChangeCode,
  } = await garageApi();

  await requestVehiclePlateChangeCode();
  const actionToken = await validateVehiclePlateChangeCode("123456");
  await changeVehiclePlateType(7, actionToken);

  assert.deepEqual(requests.map(({ url }) => url), [
    "http://localhost:8000/api/otp/request",
    "http://localhost:8000/api/otp/validate",
    "http://localhost:8000/api/vehicles/7/change-plate",
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), { purpose: "change_plate_type" });
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    purpose: "change_plate_type",
    code: "123456",
  });
  assert.equal(requests[2].options.method, "POST");
  assert.equal(requests[2].options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.equal(requests[2].options.headers["X-Action-Token"], "confirmacao-da-placa");
  assert.equal(requests[2].options.body, undefined);
});

test("não converte a placa sem código ou token de confirmação válidos", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return success(null);
  };

  const { changeVehiclePlateType, validateVehiclePlateChangeCode } = await garageApi();

  await assert.rejects(validateVehiclePlateChangeCode("12x456"), /seis números/);
  await assert.rejects(changeVehiclePlateType(7, ""), /novo código/);
  assert.equal(calls, 0);
});

test("remove o veículo pela rota autenticada", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/vehicles/7");
    assert.equal(options.method, "DELETE");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    assert.equal(options.body, undefined);
    return success(null);
  };

  const result = await (await garageApi()).deleteVehicle(7);

  assert.equal(result.status, 200);
});

test("carrega e normaliza o histórico de manutenções do veículo", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://localhost:8000/api/vehicles/7/maintenances");
    return success({
      data: [{
        id: 21,
        vehicle_id: 7,
        cost: "320.00",
        service_date: "2026-08-18T00:00:00.000000Z",
        mileage: 12000,
        service_type: "troca-oleo-filtros",
      }],
      links: {},
      meta: { total: 1 },
    });
  };

  const maintenances = await (await garageApi()).listVehicleMaintenances(7);

  assert.deepEqual(maintenances, [{
    attachment: "",
    category: "Troca oleo filtros",
    date: "18/08/2026",
    description: "",
    id: 21,
    mileage: 12000,
    readonly: false,
    status: "Realizada",
    title: "Troca oleo filtros",
    value: "320.00",
  }]);
});

test("carrega alertas pendentes e identifica vencimento por quilometragem", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      "http://localhost:8000/api/vehicles/7/maintenance-alerts?filter%5Bstatus%5D=pending",
    );
    return success({
      data: [{
        id: 31,
        title: "Troca de óleo",
        status: "pending",
        date_due: "2099-10-20",
        mileage_due: 10000,
        service_type: { id: 1, name: "Fluidos" },
      }],
      links: {},
      meta: { total: 1 },
    });
  };

  const alerts = await (await garageApi()).listVehicleAlerts(7, 12500);

  assert.deepEqual(alerts, [{
    category: "Fluidos",
    date: "20/10/2099 ou 10.000 km",
    description: "Alerta programado para este veículo.",
    id: 31,
    status: "Atrasada",
    title: "Troca de óleo",
  }]);
});

test("cadastra alerta com título derivado da categoria e prazo previsto", async () => {
  const session = startSession();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { options, url };
    return Response.json({
      status: "success",
      message: "Alerta de manutenção registrado com sucesso",
      data: { id: 32, status: "pending" },
    }, { status: 201 });
  };

  const api = await garageApi();
  const payload = api.buildMaintenanceAlertPayload({
    fields: [{ serviceTypeId: 4 }],
    form: {
      category: "troca-oleo-filtros",
      date: "2026-12-10",
      description: "Realizar a próxima troca preventiva. ",
      mileageDue: "15000",
    },
    serviceType: {
      id: null,
      identifier: "troca-oleo-filtros",
      name: "Troca de óleo e filtros",
    },
  });
  const alert = await api.createMaintenanceAlert(7, payload);

  assert.equal(request.url, "http://localhost:8000/api/vehicles/7/maintenance-alerts");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.deepEqual(JSON.parse(request.options.body), {
    title: "Troca de óleo e filtros",
    description: "Realizar a próxima troca preventiva.",
    service_type_id: 4,
    date_due: "2026-12-10",
    mileage_due: 15000,
  });
  assert.deepEqual(alert, { id: 32, status: "pending" });
});

test("associa erros do alerta aos campos visíveis do formulário", async () => {
  const api = await garageApi();
  const error = {
    status: 422,
    data: {
      errors: {
        service_type_id: ["O tipo de serviço é inválido."],
        date_due: ["Informe a data prevista."],
        mileage_due: ["Informe a quilometragem prevista."],
        description: ["Informe a descrição."],
      },
    },
  };

  assert.deepEqual(api.getMaintenanceAlertFieldErrors(error), {
    category: "O tipo de serviço é inválido.",
    date: "Informe a data prevista.",
    description: "Informe a descrição.",
    mileageDue: "Informe a quilometragem prevista.",
  });
  assert.equal(api.getMaintenanceAlertErrorMessage(error), "Confira os campos destacados e tente novamente.");
});

test("carrega e atualiza um alerta pela rota vinculada ao veículo", async () => {
  const session = startSession();
  const requests = [];
  const responseData = {
    id: 32,
    vehicle_id: 7,
    user_id: 3,
    service_type_id: 4,
    title: "Troca de Óleo e Filtros",
    description: "Realizar a próxima troca preventiva.",
    status: "pending",
    date_due: "2026-12-10",
    mileage_due: null,
    vehicle: { id: 7, plate: "ABC1D23", mileage: 75111 },
    service_type: { id: 4, name: "Troca de Óleo e Filtros" },
    user: { id: 3, name: "Pessoa" },
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ options, url });
    return success(responseData);
  };

  const api = await garageApi();
  const alert = await api.getMaintenanceAlert(7, 32);
  const updated = await api.updateMaintenanceAlert(7, 32, {
    title: "Troca de Óleo e Filtros",
    description: "Descrição atualizada.",
    service_type_id: 4,
    date_due: "2026-12-20",
  });

  assert.deepEqual(requests.map(({ options, url }) => ({
    authorization: options.headers.Authorization,
    method: options.method,
    url,
  })), [
    {
      authorization: `Bearer ${session.accessToken}`,
      method: "GET",
      url: "http://localhost:8000/api/vehicles/7/maintenance-alerts/32",
    },
    {
      authorization: `Bearer ${session.accessToken}`,
      method: "PATCH",
      url: "http://localhost:8000/api/vehicles/7/maintenance-alerts/32",
    },
  ]);
  assert.equal(alert.description, "Realizar a próxima troca preventiva.");
  assert.equal(alert.serviceTypeId, 4);
  assert.equal(alert.vehicle.plate, "ABC1D23");
  assert.deepEqual(updated, alert);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    title: "Troca de Óleo e Filtros",
    description: "Descrição atualizada.",
    service_type_id: 4,
    date_due: "2026-12-20",
  });
});

test("resolve ids omitidos na listagem de tipos usando os campos dinâmicos", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(url, "http://localhost:8000/api/service-types/troca-oleo-filtros/fields");
    return success({ data: [{
      id: 1,
      service_type_id: 4,
      name: "oil_brand",
      display_name: "Marca do óleo",
      field_type: "text",
      options: [],
      required: true,
      order: 1,
    }] });
  };

  const resolved = await (await garageApi()).resolveServiceTypeIds([
    { id: null, identifier: "troca-oleo-filtros", name: "Troca oleo filtros" },
    { id: 8, identifier: "freios", name: "Freios" },
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(resolved.map(({ id }) => id), [4, 8]);
});

test("cadastra veículo com os valores selecionados na FIPE no contrato do Laravel", async () => {
  const session = startSession();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({
      status: "success",
      message: "Veículo cadastrado com sucesso",
      data: {
        id: 9,
        brand: "Toyota",
        model: "Corolla XEi 2.0",
        year: 2024,
        plate: "ABC1D23",
        mileage: 0,
      },
    }, { status: 201 });
  };
  const { buildVehiclePayload, createVehicle } = await garageApi();
  const payload = buildVehiclePayload({
    form: {
      type: "cars",
      color: " Prata ",
      mileage: "0",
      plate: "abc-1d23",
      renavam: "12345678900",
    },
    brand: { code: "56", name: "Toyota" },
    model: { code: "1234", name: "Corolla XEi 2.0" },
    year: { code: "2024-1", name: "2024 Gasolina" },
  });

  const vehicle = await createVehicle(payload);

  assert.equal(request.url, "http://localhost:8000/api/vehicles");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.deepEqual(JSON.parse(request.options.body), {
    type: "car",
    brand: "Toyota",
    brand_code: "56",
    model: "Corolla XEi 2.0",
    year: 2024,
    mileage: 0,
    color: "Prata",
    plate: "ABC1D23",
    renavam: "12345678900",
  });
  assert.equal(vehicle.id, 9);
});

test("normaliza RENAVAM antigo para 11 dígitos antes do envio", async () => {
  const { buildVehiclePayload } = await garageApi();
  const payload = buildVehiclePayload({
    form: {
      type: "cars",
      color: "Prata",
      mileage: "0",
      plate: "ABC1D23",
      renavam: "123456789",
    },
    brand: { code: "56", name: "Toyota" },
    model: { code: "1234", name: "Corolla XEi 2.0" },
    year: { code: "2024-1", name: "2024 Gasolina" },
  });

  assert.equal(payload.renavam, "00123456789");
});

test("associa erros de validação do veículo aos campos do formulário", async () => {
  const { getVehicleErrorMessage, getVehicleFieldErrors } = await garageApi();
  const error = {
    status: 422,
    data: {
      message: "The given data was invalid.",
      errors: {
        brand_code: ["O código da marca é obrigatório."],
        renavam: ["O RENAVAM deve possuir 11 caracteres."],
      },
    },
  };

  assert.deepEqual(getVehicleFieldErrors(error), {
    brand: "O código da marca é obrigatório.",
    renavam: "O RENAVAM deve possuir 11 caracteres.",
  });
  assert.equal(getVehicleErrorMessage(error), "Confira os campos destacados e tente novamente.");
});

test("carrega tipos de serviço e usa um nome legível quando a API omite id e nome", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://localhost:8000/api/service-types?per_page=15");
    return success({
      data: [{
        identifier: "troca-oleo-filtros",
        description: "Substituição periódica de lubrificante.",
      }],
      meta: { total: 1 },
    });
  };

  const serviceTypes = await (await garageApi()).listServiceTypes();

  assert.deepEqual(serviceTypes, [{
    description: "Substituição periódica de lubrificante.",
    id: null,
    identifier: "troca-oleo-filtros",
    name: "Troca oleo filtros",
  }]);
});

test("carrega campos dinâmicos e registra manutenção no contrato em lote", async () => {
  startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/service-types/troca-oleo-filtros/fields")) {
      return success({ data: [
        {
          id: 2,
          service_type_id: 4,
          name: "oil_viscosity",
          display_name: "Viscosidade",
          field_type: "select",
          description: "Viscosidade SAE",
          options: ["5W-30"],
          required: true,
          order: 2,
        },
        {
          id: 1,
          service_type_id: 4,
          name: "oil_brand",
          display_name: "Marca do óleo",
          field_type: "text",
          options: null,
          required: true,
          order: 1,
        },
      ] });
    }
    return Response.json({
      status: "success",
      message: "Manutenções registradas com sucesso",
      data: { data: [{ id: 51 }] },
    }, { status: 201 });
  };

  const api = await garageApi();
  const fields = await api.getServiceTypeFields("troca-oleo-filtros");
  const payload = api.buildMaintenancePayload({
    vehicleId: 7,
    form: {
      category: "troca-oleo-filtros",
      date: "2026-10-24",
      description: "Troca preventiva",
      mileage: "12500",
      value: "1.234,56",
    },
    serviceType: { id: null, identifier: "troca-oleo-filtros" },
    fields,
    fieldValues: { oil_brand: "Mobil", oil_viscosity: "5W-30" },
  });
  const created = await api.createMaintenance(payload);

  assert.deepEqual(fields.map(({ name }) => name), ["oil_brand", "oil_viscosity"]);
  assert.deepEqual(payload, {
    vehicle_id: 7,
    maintenances: [{
      service_type_id: 4,
      description: "Troca preventiva",
      cost: 1234.56,
      service_date: "2026-10-24",
      mileage: 12500,
      payload: { oil_brand: "Mobil", oil_viscosity: "5W-30" },
    }],
  });
  assert.deepEqual(JSON.parse(requests[1].options.body), payload);
  assert.deepEqual(created, [{ id: 51 }]);
});

test("envia comprovantes como multipart autenticado", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/maintenances/51/attachments");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    assert.equal(options.headers["Content-Type"], undefined);
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.getAll("files[]").length, 1);
    return Response.json({ status: "success", message: "OK", data: [] }, { status: 201 });
  };

  const file = new Blob(["arquivo"], { type: "application/pdf" });
  await (await garageApi()).uploadMaintenanceAttachments(51, [file]);
});

test("carrega os detalhes completos da manutenção e seus comprovantes", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/maintenances/51");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    return success({
      id: 51,
      vehicle_id: 7,
      vehicle: { id: 7, model: "Corolla XEi", plate: "ABC1D23" },
      service_type: { id: 4, name: "Troca de Óleo", identifier: "troca-oleo" },
      description: "Troca preventiva",
      cost: 550,
      service_date: "2026-10-24",
      mileage: 75111,
      is_author: true,
      registered_by: "Você",
      payload: { oil_brand: "Mobil", changed_filter: true },
      attachments: [{
        id: 8,
        original_name: "nota.pdf",
        mime_type: "application/pdf",
        file_size: 2048,
        can_download: true,
      }],
    });
  };

  const maintenance = await (await garageApi()).getMaintenance(51);

  assert.deepEqual(maintenance, {
    attachments: [{
      canDownload: true,
      id: 8,
      mimeType: "application/pdf",
      name: "nota.pdf",
      size: 2048,
    }],
    category: "Troca de Óleo",
    cost: 550,
    date: "24/10/2026",
    description: "Troca preventiva",
    id: 51,
    mileage: 75111,
    payload: { oil_brand: "Mobil", changed_filter: true },
    readonly: false,
    registeredBy: "Você",
    serviceDate: "2026-10-24",
    serviceType: { id: 4, identifier: "troca-oleo", name: "Troca de Óleo" },
    vehicle: { id: 7, model: "Corolla XEi", plate: "ABC1D23" },
    vehicleId: 7,
  });
});

test("baixa e remove comprovantes pelas rotas autenticadas", async () => {
  startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ method: options.method, url });
    if (options.method === "GET") {
      return new Response("arquivo", { headers: { "Content-Type": "application/pdf" } });
    }
    return success(null);
  };

  const api = await garageApi();
  const blob = await api.downloadMaintenanceAttachment(8);
  await api.deleteMaintenanceAttachment(8);

  assert.ok(blob instanceof Blob);
  assert.deepEqual(requests, [
    { method: "GET", url: "http://localhost:8000/api/maintenances/attachments/8/download" },
    { method: "DELETE", url: "http://localhost:8000/api/maintenances/attachments/8" },
  ]);
});

test("associa erros da manutenção aos campos fixos e dinâmicos", async () => {
  const api = await garageApi();
  const error = {
    status: 422,
    data: {
      errors: {
        "maintenances.0.cost": ["O custo é obrigatório."],
        "maintenances.0.payload.oil_brand": ["A marca do óleo é obrigatória."],
      },
    },
  };

  assert.deepEqual(api.getMaintenanceFieldErrors(error), {
    value: "O custo é obrigatório.",
    "payload.oil_brand": "A marca do óleo é obrigatória.",
  });
  assert.equal(api.getMaintenanceErrorMessage(error), "Confira os campos destacados e tente novamente.");
});
