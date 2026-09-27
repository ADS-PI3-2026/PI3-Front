import styles from "./vehicle-plate.module.css";
import {
  formatVehiclePlate,
  getVehiclePlateType,
  normalizeVehiclePlate,
} from "../lib/vehicle-plate";

export default function VehiclePlate({ className = "", plate }) {
  const normalizedPlate = normalizeVehiclePlate(plate);
  const plateType = getVehiclePlateType(normalizedPlate);
  const displayPlate = formatVehiclePlate(normalizedPlate);
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
