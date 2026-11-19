"use client";

import { SignOutIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { isAdminUser } from "../lib/user-access";
import { logoutAuthSession } from "../session-api";
import { useSession } from "./session-provider";
import LoadingScreen from "./loading-screen";
import styles from "./admin-shell.module.css";

const AdminUserContext = createContext(null);

export function useAdminUser() {
  return useContext(AdminUserContext);
}

export default function AdminShell({ children }) {
  const router = useRouter();
  const { ready, session, warning } = useSession();
  const user = session?.user;
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (!isAdminUser(user)) router.replace("/garagem");
  }, [ready, router, user]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutAuthSession();
      router.replace("/");
    } catch {
      router.replace("/?session=logout-unconfirmed");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!ready || !user || !isAdminUser(user)) return <LoadingScreen />;

  return (
    <AdminUserContext.Provider key={session.sessionId} value={user}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerStart}>
            <div className={styles.brand}>
              <Image
                alt="Símbolo do LegadoCar"
                height={42}
                src="/legado-car-mark.svg"
                unoptimized
                width={42}
              />
              <div>
                <strong>LegadoCar</strong>
                <br />
                <span>Painel administrativo</span>
              </div>
            </div>
          </div>

          <div className={styles.account}>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button disabled={loggingOut} onClick={logout} type="button">
              <SignOutIcon aria-hidden size={19} weight="bold" />
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>

        <main className={styles.content}>
          {warning && (
            <p className="app-feedback app-feedback--error" role="status">
              {warning}
            </p>
          )}
          {children}
        </main>
      </div>
    </AdminUserContext.Provider>
  );
}
