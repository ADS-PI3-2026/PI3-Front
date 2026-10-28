"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, UserCircle } from "@phosphor-icons/react";
import { AUTH_SESSION_EVENT, getAuthSession } from "../auth-session";
import { getAuthErrorMessage } from "../auth-api";
import { getCurrentUser } from "../account-api";
import { ensureAuthSession } from "../session-api";
import { isAdminUser } from "../lib/user-access";
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
  const [user, setUser] = useState(null);
  const [warning, setWarning] = useState("");
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    let disposed = false;
    let checking = false;
    let loadedProfile = false;
    let timer;
    if (!getAuthSession()) {
      router.replace("/");
      return;
    }
    const checkSession = async () => {
      if (disposed || checking) return;
      checking = true;
      window.clearTimeout(timer);
      try {
        const session = await ensureAuthSession();
        const currentUser = loadedProfile ? session.user : await getCurrentUser();
        if (disposed) return;
        loadedProfile = true;
        if (isAdminUser(currentUser)) {
          setUser(null);
          router.replace("/admin");
          return;
        }
        setUser(currentUser);
        setWarning("");
      } catch (error) {
        if (disposed) return;
        const session = getAuthSession();
        if (!session || error.status === 401) {
          setUser(null);
          router.replace("/?session=expired");
          return;
        }
        // Uma falha temporária de rede não encerra um JWT ainda válido.
        setUser(session.user);
        setWarning(getAuthErrorMessage(error, "Não foi possível atualizar sua conta. Tente novamente."));
      } finally {
        checking = false;
        const session = getAuthSession();
        if (!disposed && session) {
          timer = window.setTimeout(checkSession, Math.min(30000, session.expiresAt - Date.now() + 50));
        }
      }
    };
    const onSessionChange = () => {
      if (!getAuthSession()) { setUser(null); router.replace("/"); }
      else if (!checking) void checkSession();
    };
    const onVisible = () => { if (!document.hidden) void checkSession(); };
    void checkSession();
    window.addEventListener(AUTH_SESSION_EVENT, onSessionChange);
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener(AUTH_SESSION_EVENT, onSessionChange);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, retryRevision, router]);

  if (!user) {
    return (
      <div aria-live="polite" className={styles.authLoading} role="status">
        Validando acesso...
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <AuthUserContext.Provider value={user}>
        <div className={styles.content}>
          {warning && <div className="app-feedback app-feedback--error" role="status">
            <p>{warning}</p>
            <button onClick={() => setRetryRevision((value) => value + 1)} type="button">Tentar novamente</button>
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
