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
        color: "Prata",
        created_at: "2026-10-29 14:30:00",
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
      color: "Prata",
      createdAt: "2026-10-29 14:30:00",
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

test("preserva a paginação da garagem e identifica quando há mais veículos", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://localhost:8000/api/vehicles?per_page=15&page=2");
    return success({
      data: [{
        id: 8,
        brand: "Honda",
        brand_code: "25",
        color: "Cinza",
        model: "HR-V",
        year: 2020,
        plate: "BRA1B34",
        mileage: 50000,
        type: "car",
      }],
      links: { next: "http://localhost:8000/api/vehicles?page=3" },
      meta: { current_page: 2, last_page: 3, total: 31 },
    });
  };

  const page = await (await garageApi()).listVehiclePage(2);

  assert.equal(page.page, 2);
  assert.equal(page.total, 31);
  assert.equal(page.hasMore, true);
  assert.equal(page.items[0].model, "HR-V");
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
      color: "Prata",
      created_at: "2026-10-29 14:30:00",
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
  assert.equal(vehicle.color, "Prata");
  assert.equal(vehicle.createdAt, "2026-10-29 14:30:00");
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
      color: "Prata",
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
  assert.equal(vehicle.color, "Prata");
});

test("atualiza a cor do veículo e normaliza a resposta", async () => {
  const session = startSession();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/vehicles/7");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, `Bearer ${session.accessToken}`);
    assert.deepEqual(JSON.parse(options.body), {
      color: "Azul",
      mileage: 13500,
    });
    return success({
      id: 7,
      brand: "Toyota",
      brand_code: "56",
      color: "Azul",
      model: "Corolla XEi 2.0",
      year: 2024,
      plate: "ABC1D23",
      mileage: 13500,
      type: "car",
    });
  };

  const vehicle = await (await garageApi()).updateVehicle(7, {
    color: "Azul",
    mileage: 13500,
  });

  assert.equal(vehicle.color, "Azul");
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

test("solicita e valida o OTP antes de remover o veículo", async () => {
  const session = startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return success(url.endsWith("/otp/validate")
      ? { action_token: "confirmacao-da-remocao" }
      : null);
  };

  const {
    deleteVehicle,
    requestVehicleDeletionCode,
    validateVehicleDeletionCode,
  } = await garageApi();

  await requestVehicleDeletionCode();
  const actionToken = await validateVehicleDeletionCode("123456");
  const result = await deleteVehicle(7, actionToken);

  assert.deepEqual(requests.map(({ url }) => url), [
    "http://localhost:8000/api/otp/request",
    "http://localhost:8000/api/otp/validate",
    "http://localhost:8000/api/vehicles/7",
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), { purpose: "vehicle_deletion" });
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    purpose: "vehicle_deletion",
    code: "123456",
  });
  assert.equal(requests[2].options.method, "DELETE");
  assert.equal(requests[2].options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.equal(requests[2].options.headers["X-Action-Token"], "confirmacao-da-remocao");
  assert.equal(requests[2].options.body, undefined);
  assert.equal(result.status, 200);
});

test("não remove o veículo sem código ou token de confirmação válidos", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return success(null);
  };

  const { deleteVehicle, validateVehicleDeletionCode } = await garageApi();

  await assert.rejects(validateVehicleDeletionCode("12x456"), /seis números/);
  await assert.rejects(deleteVehicle(7, ""), /novo código/);
  assert.equal(calls, 0);
});

test("carrega e normaliza o histórico de manutenções do veículo", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    if (url.endsWith("/vehicles/7/maintenances")) {
      return success({ data: [{
        id: 21,
        vehicle_id: 7,
        cost: "320.00",
        service_date: "2026-08-18T00:00:00.000000Z",
        mileage: 12000,
        service_type: "troca-oleo-filtros",
      }], links: {}, meta: { total: 1 } });
    }

    assert.equal(url, "http://localhost:8000/api/maintenances/21");
    return success({
      id: 21,
      vehicle_id: 7,
      vehicle: { id: 7, model: "Corolla XEi", plate: "ABC1D23" },
      service_type: { id: 4, name: "Troca de Óleo", identifier: "troca-oleo" },
      description: "Registrada pelo antigo proprietário",
      cost: 320,
      service_date: "2026-08-18",
      mileage: 12000,
      is_author: false,
      registered_by: "Proprietário Anterior",
      payload: {},
      attachments: [],
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
    readonly: true,
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

test("preserva a paginação do histórico e dos alertas do veículo", async () => {
  startSession();
  globalThis.fetch = async (url) => {
    if (url.includes("/maintenances?")) {
      assert.equal(
        url,
        "http://localhost:8000/api/vehicles/7/maintenances?per_page=15&page=2",
      );
      return success({
        data: [{
          id: 22,
          vehicle_id: 7,
          cost: "200.00",
          service_date: "2026-08-20",
          mileage: 13000,
          service_type: "alinhamento",
          is_author: true,
        }],
        links: { next: null },
        meta: { current_page: 2, last_page: 2, total: 16 },
      });
    }

    assert.equal(
      url,
      "http://localhost:8000/api/vehicles/7/maintenance-alerts?filter%5Bstatus%5D=pending&per_page=15&page=2",
    );
    return success({
      data: [{
        id: 32,
        title: "Revisão de freios",
        description: "Verificar pastilhas.",
        status: "pending",
        date_due: "2026-12-01",
        mileage_due: null,
        service_type: { name: "Freios" },
      }],
      links: { next: null },
      meta: { current_page: 2, last_page: 2, total: 16 },
    });
  };

  const api = await garageApi();
  const [maintenances, alerts] = await Promise.all([
    api.listVehicleMaintenancesPage(7, 2),
    api.listVehicleAlertsPage(7, 13000, 2),
  ]);

  assert.equal(maintenances.page, 2);
  assert.equal(maintenances.total, 16);
  assert.equal(maintenances.hasMore, false);
  assert.equal(maintenances.items[0].readonly, false);
  assert.equal(alerts.page, 2);
  assert.equal(alerts.total, 16);
  assert.equal(alerts.hasMore, false);
  assert.equal(alerts.items[0].title, "Revisão de freios");
});

test("carrega todas as páginas e os detalhes do histórico para exportação", async () => {
  startSession();
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);

    if (url.endsWith("/vehicles/7/maintenances?per_page=15&page=1")) {
      return success({
        data: [{ id: 21 }],
        links: { next: "http://localhost:8000/api/vehicles/7/maintenances?page=2" },
        meta: { current_page: 1, last_page: 2, total: 2 },
      });
    }

    if (url.endsWith("/vehicles/7/maintenances?per_page=15&page=2")) {
      return success({
        data: [{ id: 22 }],
        links: { next: null },
        meta: { current_page: 2, last_page: 2, total: 2 },
      });
    }

    const id = url.endsWith("/maintenances/21") ? 21 : 22;
    return success({
      id,
      vehicle_id: 7,
      vehicle: { id: 7, model: "Corolla XEi", plate: "ABC1D23" },
      service_type: { id: 4, name: "Troca de Óleo", identifier: "troca-oleo" },
      description: `Manutenção ${id}`,
      cost: 320,
      service_date: "2026-08-18",
      mileage: 12000 + id,
      is_author: true,
      registered_by: "Você",
      payload: {},
      attachments: [],
    });
  };

  const maintenances = await (await garageApi()).listVehicleMaintenanceDetails(7);

  assert.deepEqual(maintenances.map((maintenance) => maintenance.id), [21, 22]);
  assert.equal(maintenances[0].description, "Manutenção 21");
  assert.deepEqual(requests, [
    "http://localhost:8000/api/vehicles/7/maintenances?per_page=15&page=1",
    "http://localhost:8000/api/maintenances/21",
    "http://localhost:8000/api/vehicles/7/maintenances?per_page=15&page=2",
    "http://localhost:8000/api/maintenances/22",
  ]);
});

test("resume a próxima manutenção e os alertas atrasados usando somente a data", async () => {
  startSession();
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.endsWith("page=1")) {
      return success({
        data: [
          { id: 1, status: "pending", date_due: "2026-10-20", mileage_due: null },
          { id: 2, status: "pending", date_due: null, mileage_due: 10000 },
          { id: 3, status: "cancelled", date_due: "2026-10-10", mileage_due: null },
          { id: 4, status: "pending", date_due: "2026-12-10", mileage_due: null },
        ],
        links: { next: "http://localhost:8000/api/vehicles/7/maintenance-alerts?page=2" },
        meta: { current_page: 1, last_page: 2, total: 5 },
      });
    }

    return success({
      data: [{ id: 5, status: "pending", date_due: "2026-11-05", mileage_due: 1 }],
      links: { next: null },
      meta: { current_page: 2, last_page: 2, total: 5 },
    });
  };

  const summary = await (await garageApi()).getVehicleMaintenanceDateSummary(7, "2026-10-31");

  assert.deepEqual(summary, {
    nextDate: "2026-11-05",
    nextDateLabel: "05/11/2026",
    overdueCount: 1,
  });
  assert.deepEqual(requests, [
    "http://localhost:8000/api/vehicles/7/maintenance-alerts?filter%5Bstatus%5D=pending&per_page=15&page=1",
    "http://localhost:8000/api/vehicles/7/maintenance-alerts?filter%5Bstatus%5D=pending&per_page=15&page=2",
  ]);
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

test("inicia, consulta e valida a transferência solicitada pelo comprador", async () => {
  const session = startSession();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });

    if (url.endsWith("/start-by-buyer")) {
      return success({
        transfer_id: 41,
        vehicle_id: 7,
        status: "pending",
        initiated_by: "buyer",
        expires_at: "2026-11-01T12:00:00-03:00",
      });
    }
    if (url.endsWith("/transfers/41")) {
      return success({
        id: 41,
        vehicle: { id: 7, model: "Corolla XEi 2.0", plate: "ABC1D23" },
        status: "pending",
        initiated_by: "buyer",
        owner_validated: false,
        recipient_validated: false,
        expires_at: "2026-11-01T12:00:00-03:00",
      });
    }
    return success({
      transfer_id: 41,
      status: "pending",
      owner_validated: false,
      recipient_validated: true,
    });
  };

  const {
    buildBuyerTransferPayload,
    getVehicleTransfer,
    startVehicleTransferByBuyer,
    validateVehicleTransferCode,
  } = await garageApi();
  const payload = buildBuyerTransferPayload({ plate: "abc-1d23", renavam: "123456789" });
  const started = await startVehicleTransferByBuyer(payload);
  const loaded = await getVehicleTransfer(started.id);
  const validated = await validateVehicleTransferCode("123456");

  assert.deepEqual(payload, { plate: "ABC1D23", renavam: "00123456789" });
  assert.deepEqual(requests.map(({ url }) => url), [
    "http://localhost:8000/api/transfers/start-by-buyer",
    "http://localhost:8000/api/transfers/41",
    "http://localhost:8000/api/transfers/validate",
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), payload);
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.equal(requests[1].options.method, "GET");
  assert.deepEqual(JSON.parse(requests[2].options.body), { code: "123456" });
  assert.equal(started.initiatedBy, "buyer");
  assert.equal(loaded.vehicle.model, "Corolla XEi 2.0");
  assert.equal(validated.recipientValidated, true);
});

test("inicia a transferência pelo proprietário com o e-mail do destinatário", async () => {
  const session = startSession();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return success({
      transfer_id: 42,
      vehicle_id: 7,
      status: "pending",
      initiated_by: "owner",
      expires_at: "2026-11-01T12:00:00-03:00",
    });
  };

  const transfer = await (await garageApi()).startVehicleTransferByOwner(
    7,
    "  NOVO@EXEMPLO.COM ",
  );

  assert.equal(request.url, "http://localhost:8000/api/vehicles/7/transfers");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, `Bearer ${session.accessToken}`);
  assert.deepEqual(JSON.parse(request.options.body), {
    recipient_email: "novo@exemplo.com",
  });
  assert.equal(transfer.id, 42);
  assert.equal(transfer.initiatedBy, "owner");
});

test("não valida transferência sem um código de seis números", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return success(null);
  };

  await assert.rejects(
    (await garageApi()).validateVehicleTransferCode("12x456"),
    /seis números/,
  );
  assert.equal(calls, 0);
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

test("reconhece a sugestão segura de transferência retornada no conflito do veículo", async () => {
  const { getVehicleTransferSuggestion } = await garageApi();
  assert.deepEqual(getVehicleTransferSuggestion({
    status: 422,
    data: {
      errors: {
        can_transfer: true,
        model: "HB20 Comfort",
        owner_hint: "jo****@email.com",
        plate: "ABC1D23",
        vehicle_id: 42,
      },
    },
  }), {
    model: "HB20 Comfort",
    ownerHint: "jo****@email.com",
    plate: "ABC1D23",
    vehicleId: 42,
  });
  assert.equal(getVehicleTransferSuggestion({ status: 422, data: { errors: {} } }), null);
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

test("uma resposta inválida da lista não fica em cache impedindo nova tentativa", async () => {
  startSession();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return success(calls === 1 ? { items: [] } : []);
  };
  const { listVehicles } = await garageApi();
  await assert.rejects(listVehicles(), /resposta inesperada/);
  assert.deepEqual(await listVehicles(), []);
  assert.equal(calls, 2);
});

test("carrega todas as páginas das despesas da garagem", async () => {
  startSession();
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(url);
    const page = requestedUrls.length;
    return success({
      data: [{
        cost: page === 1 ? "125.50" : "80.00",
        id: page,
        service_date: page === 1 ? "2026-11-01" : "2026-10-20",
        service_type: page === 1 ? "troca_oleo" : "parte_eletrica",
        vehicle_id: 7,
      }],
      links: { next: page === 1 ? "http://localhost:8000/api/maintenances?page=2" : null },
      meta: { current_page: page, last_page: 2, total: 2 },
    });
  };

  const expenses = await (await garageApi()).listMaintenanceExpenses();

  assert.deepEqual(requestedUrls, [
    "http://localhost:8000/api/maintenances?per_page=15&page=1",
    "http://localhost:8000/api/maintenances?per_page=15&page=2",
  ]);
  assert.deepEqual(expenses, [
    { category: "Troca oleo", cost: 125.5, id: 1, serviceDate: "2026-11-01" },
    { category: "Parte eletrica", cost: 80, id: 2, serviceDate: "2026-10-20" },
  ]);
});
