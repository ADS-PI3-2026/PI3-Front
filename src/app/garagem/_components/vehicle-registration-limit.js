"use client";

import Link from "next/link";
import { ArrowsLeftRight, Garage } from "@phosphor-icons/react";
import styles from "./vehicle-registration-limit.module.css";

export default function VehicleRegistrationLimit({ standalone = false }) {
  return (
    <section className={styles.notice} data-standalone={standalone}>
      <span className={styles.icon}>
        <Garage aria-hidden size={26} weight="duotone" />
      </span>
      <div>
        <strong>Limite de cadastros atingido</strong>
        <p>
          Você não pode cadastrar outro veículo diretamente, mas ainda pode receber um veículo
          que já está na plataforma por transferência.
        </p>
      </div>
      <Link href="/garagem/transferencia">
        <ArrowsLeftRight aria-hidden size={19} weight="bold" />
        Solicitar transferência
      </Link>
    </section>
  );
}
