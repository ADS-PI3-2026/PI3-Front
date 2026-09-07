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
    id: 1,
    name: "Toyota Corolla",
    version: "XEi 2.0 Flex Aut.",
    plate: "BRA1B34",
    mileage: 45000,
    nextMaintenance: {
      label: "Próxima troca de óleo",
      status: "Vencida",
      tone: "danger",
      progress: 100,
    },
  },
  {
    id: 2,
    name: "Honda HR-V",
    version: "EXL 1.8 Flex",
    plate: "BRA-1234",
    mileage: 25000,
    nextMaintenance: {
      label: "Revisão de freios",
      status: "Faltam 2.500 km",
      tone: "info",
      progress: 76,
    },
  },
];

export const mockVehicleMaintenance = {
  1: [
    {
      id: 101,
      title: "Troca de Óleo",
      status: "Realizada",
      date: "18/08/2023",
      mileage: 45000,
      attachment: "NF_Troca_Oleo.pdf",
    },
    {
      id: 102,
      title: "Alinhamento",
      status: "A realizar",
      date: "20/10/2023",
      mileage: 47000,
    },
  ],
  2: [
    {
      id: 201,
      title: "Revisão de Freios",
      status: "A realizar",
      date: "15/06/2023",
      mileage: 25000,
    },
    {
      id: 202,
      title: "Troca de Óleo",
      status: "Realizada",
      date: "20/05/2023",
      mileage: 22500,
      attachment: "NF_Oleo.pdf",
    },
    {
      id: 203,
      title: "Revisão Completa",
      status: "Realizada",
      readonly: true,
      date: "10/12/2022",
      mileage: 15000,
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
