"use client";

import { CarIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import styles from "./vehicle-brand-logo.module.css";

export default function VehicleBrandLogo({ brandId, className = "", imageSize = 48, type = "cars" }) {
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
          height={imageSize}
          onError={() => setFailedLogoSrc(logoSrc)}
          src={logoSrc}
          width={imageSize}
        />
      ) : (
        <CarIcon className={styles.fallbackIcon} size={22} weight="fill" />
      )}
    </span>
  );
}
