"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CarIcon, UserCircleIcon } from "@phosphor-icons/react";
import { recheckSession, useSession } from "./session-provider";
import { isAdminUser } from "../lib/user-access";
import { consumeNavigationFeedback } from "../lib/navigation-feedback";
import LoadingScreen from "./loading-screen";
import OfflineBanner from "./offline-banner";
import { useNavigationTransition } from "./navigation-transition-provider";
import { useToast } from "./toast-provider";
import styles from "./app-shell.module.css";

const navigationItems = [
  { href: "/garagem", label: "Garagem", Icon: CarIcon },
  { href: "/perfil", label: "Perfil", Icon: UserCircleIcon },
];

const AuthUserContext = createContext(null);

export function useAuthUser() {
  return useContext(AuthUserContext);
}

export default function AppShell({ children, desktopLayout = true }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, session, warning } = useSession();
  const { showToast } = useToast();
  const user = session?.user;
  const [pendingTransition, setPendingTransition] = useNavigationTransition();
  const activeNavigationIndex = navigationItems.findIndex(({ href }) => (
    pathname === href
  ));
  const showBottomNavigation = activeNavigationIndex !== -1;
  const [entryTransition] = useState(() => (
    pendingTransition?.href === pathname ? pendingTransition : null
  ));

  useEffect(() => {
    if (pendingTransition?.href !== pathname) return;
    queueMicrotask(() => {
      setPendingTransition((current) => current === pendingTransition ? null : current);
    });
  }, [pathname, pendingTransition, setPendingTransition]);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (isAdminUser(user)) router.replace("/admin");
  }, [ready, router, user]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      const message = consumeNavigationFeedback();
      if (active && message) showToast({ message, tone: "success" });
    });
    return () => { active = false; };
  }, [pathname, showToast]);

  if (!ready || !user || isAdminUser(user)) return <LoadingScreen />;

  return (
    <div className={`${styles.shell} ${desktopLayout ? styles.desktopShell : ""} ${showBottomNavigation ? "" : styles.withoutNavigation}`}>
      <AuthUserContext.Provider key={session.sessionId} value={user}>
        <div className={`${styles.content} ${entryTransition ? styles.contentEntering : ""}`}>
          {warning && <div className="app-feedback app-feedback--error" role="status">
            <p>{warning}</p>
            <button onClick={() => void recheckSession()} type="button">Tentar novamente</button>
          </div>}
          <OfflineBanner />
          {children}
        </div>
      </AuthUserContext.Provider>
      {showBottomNavigation && <nav
        aria-label="Navegação principal"
        className={`${styles.bottomNavigation} ${entryTransition ? styles.navigationTransition : ""}`}
        style={{
          "--navigation-active-index": activeNavigationIndex,
          "--navigation-from-index": entryTransition?.fromIndex ?? activeNavigationIndex,
        }}
      >
        <span aria-hidden className={styles.navigationIndicator} />
        {navigationItems.map(({ href, label, Icon }, index) => {
          const active = index === activeNavigationIndex;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? styles.activeLink : styles.navigationLink}
              href={href}
              key={href}
              onNavigate={() => {
                if (index !== activeNavigationIndex) {
                  setPendingTransition({ href, fromIndex: activeNavigationIndex });
                }
              }}
            >
              <span className={styles.navigationIcon}>
                <Icon aria-hidden size={25} weight={active ? "fill" : "regular"} />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>}
    </div>
  );
}
