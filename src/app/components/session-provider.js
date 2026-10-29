"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import {
  getServerSessionSnapshot, getSessionSnapshot, recheckSession,
  startSessionMonitor, subscribeToSession,
} from "../session-store";

const SessionContext = createContext(null);

export function useSession() {
  const snapshot = useContext(SessionContext);
  if (!snapshot) throw new Error("A sessão precisa estar dentro do SessionProvider.");
  return snapshot;
}

export { recheckSession };

export default function SessionProvider({ children }) {
  const snapshot = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSessionSnapshot);
  useEffect(() => startSessionMonitor(), []);
  return <SessionContext.Provider value={snapshot}>{children}</SessionContext.Provider>;
}
