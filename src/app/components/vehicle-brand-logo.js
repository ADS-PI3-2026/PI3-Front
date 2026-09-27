"use client";

import { Car } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import styles from "./vehicle-brand-logo.module.css";

export default function VehicleBrandLogo({ brandId, className = "", type = "cars" }) {
  const logoSrc = brandId ? `/brandLogos/${type}/${brandId}.webp` : "";
  const [failedLogoSrc, setFailedLogoSrc] = useState("");
  const showLogo = logoSrc && failedLogoSrc !== logoSrc;

  return (
    <span
      aria-hidden="true"
      className={`${styles.logoFrame} ${className}`.trim()}
    >
      {showLogo ? (
        <Image
          alt=""
          className={styles.logo}
          height={48}
          onError={() => setFailedLogoSrc(logoSrc)}
          src={logoSrc}
          width={48}
        />
      ) : (
        <Car className={styles.fallbackIcon} size={22} weight="fill" />
      )}
    </span>
  );
}
