import { jsPDF } from "jspdf";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
const mileageFormatter = new Intl.NumberFormat("pt-BR");

function formatPayloadLabel(value) {
  const label = String(value ?? "").trim().replace(/[-_]+/g, " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Informação";
}

function formatPayloadValue(value) {
  if (Array.isArray(value)) return value.join(", ") || "Não informado";
  if (value === true || value === "true") return "Sim";
  if (value === false || value === "false") return "Não";
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Não informado";
  }
  return String(value);
}

function getGeneratedAtLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function getSafeFilePart(value) {
  return String(value ?? "veiculo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "veiculo";
}

function getTotalCost(maintenances) {
  return maintenances.reduce((total, maintenance) => {
    const cost = Number(maintenance.cost);
    return total + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}

export function getVehicleHistoryFileName(vehicle) {
  return `historico-${getSafeFilePart(vehicle?.plate || vehicle?.model)}.pdf`;
}

export function createVehicleHistoryPdf({ maintenances, vehicle }) {
  const document = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;
  let cursorY = 0;

  const addPageHeader = (continuation = false) => {
    document.setFillColor(7, 71, 147);
    document.rect(0, 0, pageWidth, 25, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text("LegadoCar", margin, 11);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text(
      continuation ? "Histórico de manutenção — continuação" : "Histórico detalhado de manutenção",
      margin,
      18,
    );
    document.setTextColor(35, 38, 48);
    cursorY = 34;
  };

  const addPage = () => {
    document.addPage();
    addPageHeader(true);
  };

  const ensureSpace = (height) => {
    if (cursorY + height > bottomLimit) addPage();
  };

  const writeWrappedText = (text, {
    color = [75, 82, 96],
    fontSize = 9,
    indent = 0,
    lineHeight = 4.6,
    style = "normal",
  } = {}) => {
    document.setFont("helvetica", style);
    document.setFontSize(fontSize);
    document.setTextColor(...color);
    const lines = document.splitTextToSize(String(text), contentWidth - indent);

    for (const line of lines) {
      ensureSpace(lineHeight);
      document.text(line, margin + indent, cursorY);
      cursorY += lineHeight;
    }
  };

  addPageHeader();
  document.setFont("helvetica", "bold");
  document.setFontSize(14);
  document.text(`${vehicle.brand} ${vehicle.model}`, margin, cursorY);
  cursorY += 6;
  writeWrappedText(
    `Placa: ${vehicle.plate}   |   Ano: ${vehicle.year || "Não informado"}   |   Quilometragem atual: ${mileageFormatter.format(vehicle.mileage)} km`,
    { color: [75, 82, 96], fontSize: 9 },
  );
  writeWrappedText(`Relatório gerado em ${getGeneratedAtLabel()}.`, {
    color: [112, 120, 135],
    fontSize: 8,
  });

  cursorY += 3;
  document.setFillColor(239, 244, 255);
  document.roundedRect(margin, cursorY, contentWidth, 18, 3, 3, "F");
  document.setTextColor(7, 71, 147);
  document.setFont("helvetica", "bold");
  document.setFontSize(10);
  document.text(`${maintenances.length} serviço(s) registrado(s)`, margin + 6, cursorY + 7);
  document.text(`Total: ${currencyFormatter.format(getTotalCost(maintenances))}`, margin + 6, cursorY + 13);
  cursorY += 26;

  maintenances.forEach((maintenance, index) => {
    ensureSpace(32);
    document.setDrawColor(218, 222, 232);
    document.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 7;

    document.setTextColor(35, 38, 48);
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.text(`${index + 1}. ${maintenance.category}`, margin, cursorY);
    cursorY += 6;

    const cost = Number(maintenance.cost);
    writeWrappedText(
      `Data: ${maintenance.date}   |   Quilometragem: ${mileageFormatter.format(maintenance.mileage)} km   |   Valor: ${currencyFormatter.format(Number.isFinite(cost) ? cost : 0)}`,
      { color: [75, 82, 96], fontSize: 8.5 },
    );
    writeWrappedText(`Registrado por: ${maintenance.registeredBy || "Não informado"}`, {
      color: [75, 82, 96],
      fontSize: 8.5,
    });

    if (maintenance.description) {
      cursorY += 2;
      writeWrappedText("Descrição", { color: [35, 38, 48], fontSize: 9, style: "bold" });
      writeWrappedText(maintenance.description, { indent: 2 });
    }

    const payloadEntries = Object.entries(maintenance.payload ?? {});
    if (payloadEntries.length > 0) {
      cursorY += 2;
      writeWrappedText("Detalhes do serviço", { color: [35, 38, 48], fontSize: 9, style: "bold" });
      for (const [field, value] of payloadEntries) {
        writeWrappedText(`${formatPayloadLabel(field)}: ${formatPayloadValue(value)}`, { indent: 2 });
      }
    }

    if (maintenance.attachments.length > 0) {
      cursorY += 2;
      writeWrappedText("Comprovantes", { color: [35, 38, 48], fontSize: 9, style: "bold" });
      writeWrappedText(maintenance.attachments.map((attachment) => attachment.name).join(", "), {
        indent: 2,
      });
    }

    cursorY += 5;
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(112, 120, 135);
    document.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }

  document.setProperties({
    author: "LegadoCar",
    subject: "Histórico de manutenção veicular",
    title: `Histórico de ${vehicle.brand} ${vehicle.model}`,
  });

  return document;
}

export function downloadVehicleHistoryPdf(data) {
  const document = createVehicleHistoryPdf(data);
  document.save(getVehicleHistoryFileName(data.vehicle));
}
