"use client";

import { WifiSlashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import styles from "./offline-banner.module.css";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  if (online) return null;

  return (
    <aside className={styles.banner} role="status">
      <WifiSlashIcon aria-hidden size={22} weight="duotone" />
      <div>
        <strong>Você está offline</strong>
        <p>Algumas informações podem estar desatualizadas.</p>
      </div>
    </aside>
  );
}
