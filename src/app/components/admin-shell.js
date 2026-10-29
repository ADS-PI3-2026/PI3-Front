"use client";

import {
  ArrowsLeftRight,
  ChartBar,
  ClipboardText,
  FileText,
  House,
  List,
  SignOut,
  UsersThree,
  Wrench,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { isAdminUser } from "../lib/user-access";
import { logoutAuthSession } from "../session-api";
import { useSession } from "./session-provider";
import LoadingScreen from "./loading-screen";
import styles from "./admin-shell.module.css";

const plannedNavigation = [
  { label: "Usuários", Icon: UsersThree },
  { label: "Tipos de serviço", Icon: Wrench },
  { label: "Mediações", Icon: ArrowsLeftRight },
  { label: "Auditoria", Icon: ClipboardText },
];

const availableNavigation = [
  { href: "/admin", label: "Visão geral", Icon: House },
  { href: "/admin/conteudos-legais", label: "Textos legais", Icon: FileText },
];

const AdminUserContext = createContext(null);

export function useAdminUser() {
  return useContext(AdminUserContext);
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, session, warning } = useSession();
  const user = session?.user;
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (!isAdminUser(user)) router.replace("/garagem");
  }, [ready, router, user]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

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
            <button
              aria-controls="admin-sidebar"
              aria-expanded={menuOpen}
              aria-label="Abrir menu administrativo"
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <List aria-hidden size={23} weight="bold" />
            </button>
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
                <br/>
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
              <SignOut aria-hidden size={19} weight="bold" />
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>

        <div className={styles.layout}>
          {menuOpen && (
            <button
              aria-label="Fechar menu administrativo"
              className={styles.menuOverlay}
              onClick={() => setMenuOpen(false)}
              type="button"
            />
          )}
          <aside
            className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
            id="admin-sidebar"
          >
            <div className={styles.sidebarHeader}>
              <strong>Menu administrativo</strong>
              <button
                aria-label="Fechar menu administrativo"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X aria-hidden size={21} weight="bold" />
              </button>
            </div>
            <nav aria-label="Navegação administrativa">
              {availableNavigation.map(({ href, label, Icon }) => {
                const active = href === "/admin"
                  ? pathname === href
                  : pathname.startsWith(href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? styles.activeNavigation : styles.navigation}
                    href={href}
                    key={href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon aria-hidden size={20} weight={active ? "fill" : "duotone"} />
                    {label}
                  </Link>
                );
              })}
              {plannedNavigation.map(({ label, Icon }) => (
                <span aria-disabled="true" className={styles.plannedNavigation} key={label}>
                  <Icon aria-hidden size={20} weight="duotone" />
                  <span>{label}</span>
                  <small>Em breve</small>
                </span>
              ))}
            </nav>
          </aside>

          <main className={styles.content}>
            {warning && (
              <p className="app-feedback app-feedback--error" role="status">{warning}</p>
            )}
            {children}
          </main>
        </div>
      </div>
    </AdminUserContext.Provider>
  );
}
