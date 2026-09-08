import styles from "./vehicle-plate.module.css";

function normalizePlate(plate) {
  return String(plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getPlateType(value) {
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(value)) return "mercosul";
  if (/^[A-Z]{3}[0-9]{4}$/.test(value)) return "antiga";
  return "default";
}

function formatPlate(value, type) {
  if (type === "antiga" && value.length === 7) {
    return value.slice(0, 3) + "-" + value.slice(3);
  }
  return value;
}

export default function VehiclePlate({ className = "", plate }) {
  const normalizedPlate = normalizePlate(plate);
  const plateType = getPlateType(normalizedPlate);
  const displayPlate = formatPlate(normalizedPlate, plateType);
  const classes = [styles.plate, styles[plateType], className].filter(Boolean).join(" ");

  return (
    <span aria-label={"Placa " + displayPlate} className={classes}>
      {plateType === "mercosul" && (
        <span aria-hidden className={styles.mercosulTop}>
          <span className={styles.country}>BRASIL</span>
        </span>
      )}
      {plateType === "antiga" && <span aria-hidden className={styles.oldPlateTexture} />}
      <span className={styles.plateNumber}>{displayPlate}</span>      
    </span>
  );
}
