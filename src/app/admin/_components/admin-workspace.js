"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircleIcon, UsersThreeIcon, WrenchIcon } from "@phosphor-icons/react";
import { useAdminUser } from "../../components/admin-shell";
import { getAdminOverview } from "../admin-api";
import { adminTabs, nextAdminTab, resolveAdminTab, updateAdminWorkspaceHref } from "../_lib/admin-workspace";
import { PageHeading, ResourceState, useAdminResource } from "./admin-ui";
import InternalUsersPanel from "./internal-users-panel";
import ServiceTypesPanel from "./service-types-panel";
import LegalContentPanel from "./legal-content-panel";
import MediationsPanel from "./mediations-panel";
import AuditPanel from "./audit-panel";
import styles from "../admin.module.css";

export default function AdminWorkspace() {
  const user = useAdminUser();
  const params = useSearchParams();
  const router = useRouter();
  const selected = resolveAdminTab(params.get("aba"));
  const tabs = useRef({});
  const overview = useAdminResource(getAdminOverview);
  const selectTab = (id, status) => {
    router.push(updateAdminWorkspaceHref(params, {
      aba: id,
      novo: "",
      ...(status === undefined ? {} : { status }),
    }), { scroll: false });
  };
  const panels = {
    administradores: <InternalUsersPanel active={selected === "administradores"} onChanged={overview.reload} />,
    servicos: <ServiceTypesPanel active={selected === "servicos"} />,
    textos: <LegalContentPanel active={selected === "textos"} />,
    mediacoes: <MediationsPanel />,
    auditoria: <AuditPanel />,
  };

  return (
    <div className={styles.page}>
      <PageHeading
        description="Acompanhe os totais e gerencie os cadastros em um só lugar."
        title={`Olá, ${user.name.trim().split(/\s+/)[0]}`}
      />
      <section aria-label="Resumo administrativo" aria-busy={overview.loading}>
        <ResourceState {...overview} keepContent retry={overview.reload}>
          {overview.data && (
            <div className={styles.stats}>
              {[
                { label: "Administradores", value: overview.data.administrators, tab: "administradores", Icon: UsersThreeIcon },
                { label: "Tipos de serviço", value: overview.data.services, tab: "servicos", status: "", Icon: WrenchIcon },
                { label: "Tipos de serviço ativos", value: overview.data.activeServices, tab: "servicos", status: "1", Icon: CheckCircleIcon },
              ].map(({ label, value, tab, status, Icon }) => (
                <button className={`${styles.panel} ${styles.stat}`} key={label} onClick={() => selectTab(tab, status)} type="button">
                  <span className={styles.statLabel}>
                    <span>{label}</span>
                    <Icon aria-hidden size={23} />
                  </span>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
          )}
        </ResourceState>
      </section>

      <div className={styles.workspace}>
        <div aria-label="Módulos administrativos" className={styles.workspaceTabs} role="tablist">
          {adminTabs.map(({ id, label }) => (
            <button
              aria-controls={`admin-panel-${id}`}
              aria-selected={id === selected}
              id={`admin-tab-${id}`}
              key={id}
              onClick={() => selectTab(id)}
              onKeyDown={(event) => {
                const next = nextAdminTab(id, event.key);
                if (!next) return;
                event.preventDefault();
                selectTab(next);
                tabs.current[next]?.focus();
              }}
              ref={(element) => { tabs.current[id] = element; }}
              role="tab"
              tabIndex={id === selected ? 0 : -1}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {adminTabs.map(({ id }) => (
          <section
            aria-labelledby={`admin-tab-${id}`}
            className={styles.workspacePanel}
            hidden={selected !== id}
            id={`admin-panel-${id}`}
            key={id}
            role="tabpanel"
            tabIndex={0}
          >
            {panels[id]}
          </section>
        ))}
      </div>
    </div>
  );
}
