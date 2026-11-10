import styles from "./vehicle-plate.module.css";
import {
  formatVehiclePlate,
  getVehiclePlateType,
  normalizeVehiclePlate,
} from "../lib/vehicle-plate";

export default function VehiclePlate({ className = "", plate, type = "cars" }) {
  const normalizedPlate = normalizeVehiclePlate(plate);
  const plateType = getVehiclePlateType(normalizedPlate);
  const displayPlate = formatVehiclePlate(normalizedPlate);
  const isMotorcycle = ["motorcycle", "motorcycles"].includes(type);
  const classes = [
    styles.plate,
    styles[plateType],
    isMotorcycle ? styles.motorcycle : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span aria-label={"Placa " + displayPlate} className={classes}>
      {plateType === "mercosul" && (
        <>
          <span aria-hidden className={styles.mercosulTop}>
            <span className={styles.country}>BRASIL</span>
            <span className={styles.brazilFlag} />
          </span>
          <span aria-hidden className={styles.mercosulCountryCode}>BR</span>
        </>
      )}
      {plateType === "antiga" && (
        <>
          <span aria-hidden className={styles.oldPlateTexture} />
          <span aria-hidden className={styles.oldPlateTop}>LC - LEGADOCAR</span>
        </>
      )}
      {isMotorcycle && normalizedPlate.length === 7 ? (
        <span className={`${styles.plateNumber} ${styles.motorcycleNumber}`}>
          <span>{normalizedPlate.slice(0, 3)}</span>
          <span>{normalizedPlate.slice(3)}</span>
        </span>
      ) : (
        <span className={styles.plateNumber}>{displayPlate}</span>
      )}
    </span>
  );
}
