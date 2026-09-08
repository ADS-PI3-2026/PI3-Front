"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Car, UserCircle } from "@phosphor-icons/react";
import { getAuthSession } from "../auth-session";
import styles from "./app-shell.module.css";

const navigationItems = [
  { href: "/garagem", label: "Garagem", Icon: Car },
  { href: "/perfil", label: "Perfil", Icon: UserCircle },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (!getAuthSession()) {
      router.replace("/");
      return;
    }

    const readyTimer = window.setTimeout(() => setSessionReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, [router]);

  if (!sessionReady) {
    return (
      <div aria-live="polite" className={styles.authLoading} role="status">
        Validando acesso...
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.content}>{children}</div>
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
