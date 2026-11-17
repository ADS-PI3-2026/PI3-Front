"use client";

import Link from "next/link";
import { ArrowLeftIcon, CarIcon, UserCircleIcon } from "@phosphor-icons/react";
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
      <nav aria-label="Navegação principal" className={styles.desktopNavigation}>
        <Link href="/garagem">
          <CarIcon aria-hidden size={22} />
          Garagem
        </Link>
        <Link href="/perfil">
          <UserCircleIcon aria-hidden size={22} />
          Perfil
        </Link>
      </nav>
    </header>
  );
}
