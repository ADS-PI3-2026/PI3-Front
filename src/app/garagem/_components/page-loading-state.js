"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";
import styles from "./page-loading-state.module.css";

export default function PageLoadingState({ compact = false, message }) {
  return (
    <section
      aria-live="polite"
      className={`${styles.state} ${compact ? styles.compact : ""}`.trim()}
      role="status"
    >
      <CircleNotchIcon aria-hidden className={styles.spinner} size={34} weight="bold" />
      <p>{message}</p>
    </section>
  );
}
