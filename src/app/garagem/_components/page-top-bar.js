"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import styles from "./page-top-bar.module.css";

export default function PageTopBar({ backHref = "", title }) {
  const router = useRouter();

  const goBack = () => {
    if (backHref) {
      router.push(backHref);
      return;
    }

    router.back();
  };

  return (
    <header className={styles.topBar}>
      <button aria-label="Voltar" className={styles.backButton} onClick={goBack} type="button">
        <ArrowLeftIcon aria-hidden size={24} weight="bold" />
      </button>
      <h1 className="app-page-title">{title}</h1>
      <span />
    </header>
  );
}
