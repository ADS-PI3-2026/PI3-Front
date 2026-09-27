const LEGACY_TO_MERCOSUL_CHARACTER = Object.freeze({
  0: "A",
  1: "B",
  2: "C",
  3: "D",
  4: "E",
  5: "F",
  6: "G",
  7: "H",
  8: "I",
  9: "J",
});

export function normalizeVehiclePlate(plate) {
  return String(plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getVehiclePlateType(plate) {
  const value = normalizeVehiclePlate(plate);

  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(value)) return "mercosul";
  if (/^[A-Z]{3}[0-9]{4}$/.test(value)) return "antiga";
  return "default";
}

export function formatVehiclePlate(plate) {
  const value = normalizeVehiclePlate(plate);

  if (getVehiclePlateType(value) === "antiga") {
    return `${value.slice(0, 3)}-${value.slice(3)}`;
  }

  return value;
}

export function convertLegacyPlateToMercosul(plate) {
  const value = normalizeVehiclePlate(plate);

  if (getVehiclePlateType(value) !== "antiga") return null;

  const replacement = LEGACY_TO_MERCOSUL_CHARACTER[value[4]];
  return `${value.slice(0, 4)}${replacement}${value.slice(5)}`;
}
