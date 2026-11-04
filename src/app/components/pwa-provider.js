"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const PwaContext = createContext(null);

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

export function usePwaInstall() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("A instalação PWA precisa estar dentro do PwaProvider.");
  return value;
}

export default function PwaProvider({ children }) {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateInstalledState = () => {
      const nextInstalled = isStandaloneMode();
      setInstalled(nextInstalled);
      if (nextInstalled) setInstallEvent(null);
    };
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      if (!isStandaloneMode()) setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    updateInstalledState();
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener?.("change", updateInstalledState);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A aplicação continua funcionando normalmente sem o Service Worker.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener?.("change", updateInstalledState);
    };
  }, []);

  const value = useMemo(() => ({
    canInstall: Boolean(installEvent) && !installed,
    installed,
    install: async () => {
      if (!installEvent || installed) return "unavailable";
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      return choice.outcome;
    },
  }), [installEvent, installed]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
