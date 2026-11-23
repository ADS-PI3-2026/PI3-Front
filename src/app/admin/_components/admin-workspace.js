"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowsLeftRightIcon, CarIcon, UsersThreeIcon, WrenchIcon } from "@phosphor-icons/react";
import { useAdminUser } from "../../components/admin-shell";
import { getAdminOverview } from "../admin-api";
import { adminTabs, nextAdminTab, resolveAdminTab, updateAdminWorkspaceHref } from "../_lib/admin-workspace";
import { PageHeading, ResourceState, useAdminResource } from "./admin-ui";
import InternalUsersPanel from "./internal-users-panel";
import ServiceTypesPanel from "./service-types-panel";
import LegalContentPanel from "./legal-content-panel";
import OperationTable from "./operation-tables";
import AdminRecordDialog from "./admin-record-dialog";
import styles from "../admin.module.css";

export default function AdminWorkspace() {
  const user = useAdminUser();
  const params = useSearchParams();
  const router = useRouter();
  const selected = resolveAdminTab(params.get("aba"));
  const tabs = useRef({});
  const [record, setRecord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transferPreset, setTransferPreset] = useState(0);
  useEffect(() => { queueMicrotask(() => setRecord(null)); }, [selected]);
  const overview = useAdminResource(getAdminOverview);
  const changed = () => { overview.reload(); setRefreshKey(value => value + 1); };
  const openRecord = (kind, id) => setRecord({ kind, id, tab: selected });
  const selectTab = (id, status, openTransfers = false) => {
    setRecord(null);
    if (openTransfers) setTransferPreset(value => value + 1);
    router.push(updateAdminWorkspaceHref(params, {
      aba: id,
      novo: "",
      ...(status === undefined ? {} : { status }),
    }), { scroll: false });
  };
  const panels = {
    administradores: <InternalUsersPanel active={selected === "administradores"} onChanged={overview.reload} />,
    usuarios: <OperationTable kind="users" active={selected === "usuarios"} onOpen={openRecord} refreshKey={refreshKey} />,
    veiculos: <OperationTable kind="vehicles" active={selected === "veiculos"} onOpen={openRecord} refreshKey={refreshKey} />,
    servicos: <ServiceTypesPanel active={selected === "servicos"} onChanged={overview.reload} />,
    textos: <LegalContentPanel active={selected === "textos"} />,
    mediacoes: <OperationTable key={transferPreset} initialFilters={transferPreset ? { status: "pending,expired" } : {}} kind="transfers" active={selected === "mediacoes"} onOpen={openRecord} refreshKey={refreshKey} />,
    auditoria: <OperationTable kind="audits" active={selected === "auditoria"} onOpen={openRecord} refreshKey={refreshKey} />,
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
                { label: "Usuários do aplicativo", value: overview.data.users, tab: "usuarios", detail: `${overview.data.administrators} ${overview.data.administrators === 1 ? "administrador" : "administradores"} na equipe`, Icon: UsersThreeIcon },
                { label: "Veículos", value: overview.data.vehicles, tab: "veiculos", detail: "Veículos ativos na plataforma", Icon: CarIcon },
                { label: "Transferências em aberto", value: overview.data.openTransfers, tab: "mediacoes", detail: "Pendentes e expiradas", Icon: ArrowsLeftRightIcon },
                { label: "Tipos de serviço", value: overview.data.services, tab: "servicos", status: "", detail: `${overview.data.activeServices} ${overview.data.activeServices === 1 ? "ativo" : "ativos"} no catálogo`, Icon: WrenchIcon },
              ].map(({ label, value, tab, status, detail, Icon }) => (
                <button className={`${styles.panel} ${styles.stat}`} key={label} onClick={() => selectTab(tab, status, tab === "mediacoes")} type="button">
                  <span className={styles.statLabel}>
                    <span>{label}</span>
                    <Icon aria-hidden size={23} />
                  </span>
                  <strong>{value}</strong>
                  <small>{detail}</small>
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
      {record?.tab === selected && <AdminRecordDialog
        key={`${record.kind}-${record.id}`}
        {...record}
        onBack={record.previous ? () => setRecord(record.previous) : undefined}
        onChanged={changed}
        onClose={() => setRecord(null)}
        onOpen={(kind, id) => setRecord(previous => ({ kind, id, tab: selected, previous }))}
      />}
    </div>
  );
}
