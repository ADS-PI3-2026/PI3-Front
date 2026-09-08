"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import styles from "./page-top-bar.module.css";

export default function PageTopBar({ title }) {
  const router = useRouter();

  return (
    <header className={styles.topBar}>
      <button aria-label="Voltar" className={styles.backButton} onClick={() => router.back()} type="button">
        <ArrowLeft aria-hidden size={24} weight="bold" />
      </button>
      <h1>{title}</h1>
      <span />
    </header>
  );
}
