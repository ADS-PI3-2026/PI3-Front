export const mockUser = {
  id: 1,
  personType: "PF",
  name: "João da Silva",
  email: "joao.silva@email.com",
  document: "529.982.247-25",
  phone: "(54) 99999-1234",
};

export const expenseSummary = {
  total: 3200,
  serviceCount: 12,
  categories: [
    { name: "Mecânica", value: 50, amount: 1600, color: "#074793" },
    { name: "Elétrica", value: 30, amount: 960, color: "#52627a" },
    { name: "Fluidos", value: 20, amount: 640, color: "#8a2e06" },
  ],
};

export const mockVehicles = [
  {
    brandId: "56",
    id: 1,
    name: "Toyota Corolla",
    version: "XEi 2.0 Flex Aut.",
    plate: "BRA1B34",
    mileage: 45000,
    type: "cars",
    nextMaintenance: {
      label: "Alinhamento",
      status: "Vence em 20/10/2026",
      tone: "info",
      progress: 72,
    },
  },
  {
    brandId: "25",
    id: 2,
    name: "Honda HR-V",
    version: "EXL 1.8 Flex",
    plate: "BRA-1234",
    mileage: 25000,
    type: "cars",
    nextMaintenance: {
      label: "Geometria e balanceamento",
      status: "Vencida em 01/09/2026",
      tone: "danger",
      progress: 100,
    },
  },
];

export const mockVehicleMaintenance = {
  1: [
    {
      attachment: "NF_Troca_Oleo.pdf",
      category: "Fluidos",
      date: "18/08/2023",
      description: "Troca de óleo do motor e filtro de óleo.",
      id: 101,
      mileage: 45000,
      status: "Realizada",
      title: "Troca de Óleo",
      value: "320,00",
    },
  ],
  2: [
    {
      attachment: "NF_Oleo.pdf",
      category: "Fluidos",
      date: "20/05/2026",
      description: "Troca de óleo e revisão dos níveis de fluidos.",
      id: 203,
      mileage: 22500,
      status: "Realizada",
      title: "Troca de Óleo",
      value: "410,00",
    },
    {
      category: "Mecânica",
      date: "10/12/2025",
      description: "Revisão completa registrada pelo proprietário anterior.",
      id: 204,
      mileage: 15000,
      readonly: true,
      status: "Realizada",
      title: "Revisão Completa",
      value: "1.250,00",
    },
  ],
};

export const mockVehicleAlerts = {
  1: [
    {
      category: "Pneus",
      date: "20/10/2026",
      description: "Realizar alinhamento e verificar o balanceamento.",
      id: 102,
      status: "A realizar",
      title: "Alinhamento",
    },
  ],
  2: [
    {
      category: "Mecânica",
      date: "15/10/2026",
      description: "Verificar pastilhas, discos e fluido de freio.",
      id: 201,
      status: "A realizar",
      title: "Revisão de Freios",
    },
    {
      category: "Pneus",
      date: "01/09/2026",
      description: "Executar geometria e balanceamento das rodas.",
      id: 202,
      status: "Atrasada",
      title: "Geometria e Balanceamento",
    },
  ],
};

export const maintenanceCategories = [
  "Mecânica",
  "Elétrica",
  "Fluidos",
  "Pneus",
  "Documentação",
];

export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMileage(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function getVehicleById(id) {
  return mockVehicles.find((vehicle) => String(vehicle.id) === String(id));
}

export function getVehicleMaintenance(id) {
  return mockVehicleMaintenance[id] ?? [];
}

export function getVehicleAlerts(id) {
  return mockVehicleAlerts[id] ?? [];
}

export function getMaintenanceById(vehicleId, maintenanceId) {
  return [...getVehicleMaintenance(vehicleId), ...getVehicleAlerts(vehicleId)]
    .find((item) => String(item.id) === String(maintenanceId));
}
