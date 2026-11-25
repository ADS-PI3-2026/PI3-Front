"use client";

import Link from "next/link";
import { ArrowLeftIcon, GarageIcon } from "@phosphor-icons/react";
import styles from "./vehicle-registration-limit.module.css";

export default function VehicleRegistrationLimit({ standalone = false }) {
  return (
    <section className={styles.notice} data-standalone={standalone}>
      <span className={styles.icon}>
        <GarageIcon aria-hidden size={26} weight="duotone" />
      </span>
      <div>
        <strong>Limite de veículos atingido</strong>
        <p>
          Sua garagem atingiu o limite de 5 veículos. Para cadastrar ou receber outro veículo por
          transferência, remova primeiro um veículo da garagem.
        </p>
      </div>
      {standalone && (
        <Link href="/garagem">
          <ArrowLeftIcon aria-hidden size={19} weight="bold" />
          Voltar para a garagem
        </Link>
      )}
    </section>
  );
}
