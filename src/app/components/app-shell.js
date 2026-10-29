"use client";

import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, UserCircle } from "@phosphor-icons/react";
import { recheckSession, useSession } from "./session-provider";
import { isAdminUser } from "../lib/user-access";
import LoadingScreen from "./loading-screen";
import styles from "./app-shell.module.css";

const navigationItems = [
  { href: "/garagem", label: "Garagem", Icon: Car },
  { href: "/perfil", label: "Perfil", Icon: UserCircle },
];

const AuthUserContext = createContext(null);

export function useAuthUser() {
  return useContext(AuthUserContext);
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, session, warning } = useSession();
  const user = session?.user;

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (isAdminUser(user)) router.replace("/admin");
  }, [ready, router, user]);

  if (!ready || !user || isAdminUser(user)) return <LoadingScreen />;

  return (
    <div className={styles.shell}>
      <AuthUserContext.Provider key={session.sessionId} value={user}>
        <div className={styles.content}>
          {warning && <div className="app-feedback app-feedback--error" role="status">
            <p>{warning}</p>
            <button onClick={() => void recheckSession()} type="button">Tentar novamente</button>
          </div>}
          {children}
        </div>
      </AuthUserContext.Provider>
      <nav aria-label="Navegação principal" className={styles.bottomNavigation}>
        {navigationItems.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? styles.activeLink : styles.navigationLink}
              href={href}
              key={href}
            >
              <span className={styles.navigationIcon}>
                <Icon aria-hidden size={25} weight={active ? "fill" : "regular"} />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
