"use client";

import { useCallback, useState } from "react";
import { ArrowClockwiseIcon, ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { listAdminUsers, listAdminVehicles, listAdminTransfers, listAdminAuditLogs } from "../operations-api";
import { auditEventLabels, formatAdminDateTime, getAdminFilterError, transferStatuses, transferStatusLabels } from "../_lib/admin-operations";
import { Feedback, Field, PageHeading, Pagination, ResourceState, useAdminResource } from "./admin-ui";
import styles from "../admin.module.css";

export function TransferStatus({ transfer }) {
  const status = transfer.status === "pending" && transfer.is_expired ? "expired" : transfer.status;
  const color = status === "completed" ? styles.activeStatus : ["pending", "expired"].includes(status) ? styles.pendingStatus : styles.inactiveStatus;
  return <span className={color}>{transferStatusLabels[status] ?? status}</span>;
}

export function RecordStatus({ deleted }) {
  return <span className={deleted ? styles.inactiveStatus : styles.activeStatus}>{deleted ? "Excluído" : "Ativo"}</span>;
}

const configs = {
  users: {
    load: listAdminUsers, title: "Usuários do aplicativo", description: "Consulte os cadastros e os veículos vinculados a cada conta.",
    filters: [
      { key: "name", label: "Nome", placeholder: "Buscar por nome" },
      { key: "email", label: "E-mail", placeholder: "Buscar por e-mail" },
      { key: "document", label: "CPF ou CNPJ", placeholder: "Documento completo" },
      { key: "include_deleted", label: "Incluir contas excluídas", type: "checkbox" },
    ],
    sorts: [["-created_at", "Mais recentes"], ["name", "Nome A–Z"], ["-name", "Nome Z–A"], ["-vehicles_count", "Mais veículos"]],
    columns: [
      ["Usuário", item => <><strong>{item.name}</strong><small>#{item.id} · {item.email}</small></>],
      ["Documento", item => <>{item.document || "—"}<small>{item.document_type?.toUpperCase()}</small></>],
      ["Veículos", item => item.vehicles_count ?? 0],
      ["Situação", item => <RecordStatus deleted={item.is_deleted || item.deleted_at} />],
      ["Cadastro", item => formatAdminDateTime(item.created_at)],
    ],
  },
  vehicles: {
    load: listAdminVehicles, title: "Veículos", description: "Localize veículos, consulte a custódia e acompanhe os vínculos de transferência.",
    filters: [
      { key: "plate", label: "Placa", placeholder: "Placa completa", maxLength: 8 },
      { key: "brand", label: "Marca", placeholder: "Buscar por marca" },
      { key: "model", label: "Modelo", placeholder: "Buscar por modelo" },
      { key: "year", label: "Ano", type: "number", min: 1900, max: 2100 },
      { key: "user_id", label: "ID do proprietário", type: "number", min: 1 },
      { key: "include_deleted", label: "Incluir veículos excluídos", type: "checkbox" },
    ],
    sorts: [["-created_at", "Mais recentes"], ["model", "Modelo A–Z"], ["brand", "Marca A–Z"], ["-year", "Ano mais novo"], ["-maintenances_count", "Mais manutenções"]],
    columns: [
      ["Veículo", item => <><strong>{item.brand} {item.model}</strong><small>#{item.id} · {item.year}</small></>],
      ["Placa", item => <strong>{item.plate}</strong>],
      ["Proprietário", item => <>{item.user?.name ?? "Sem proprietário"}<small>{item.user?.email}</small></>],
      ["Manutenções", item => item.maintenances_count ?? 0],
      ["Situação", item => <><RecordStatus deleted={item.deleted_at} />{item.active_transfer && <small>Transferência em aberto</small>}</>],
    ],
  },
  transfers: {
    load: listAdminTransfers, title: "Mediações técnicas", description: "Acompanhe as partes e as confirmações das transferências de veículos.",
    filters: [
      { key: "status", label: "Situação", options: transferStatuses },
      { key: "plate", label: "Placa", placeholder: "Buscar por placa", maxLength: 8 },
      { key: "recipient_email", label: "E-mail do destinatário", placeholder: "Buscar por e-mail" },
      { key: "initiated_by", label: "Solicitado por", options: [["", "Todos"], ["owner", "Proprietário"], ["buyer", "Comprador"]] },
      { key: "vehicle_id", label: "ID do veículo", type: "number", min: 1 },
    ],
    sorts: [["-created_at", "Mais recentes"], ["expires_at", "Vencimento mais próximo"], ["-failed_attempts", "Mais tentativas"], ["status", "Situação"]],
    columns: [
      ["Transferência", item => <><strong>#{item.id} · {item.vehicle?.plate ?? "Veículo indisponível"}</strong><small>{item.vehicle?.brand} {item.vehicle?.model}</small></>],
      ["Proprietário de origem", item => <>{item.current_owner?.name ?? "Conta indisponível"}<small>{item.current_owner?.email}</small></>],
      ["Destinatário", item => <>{item.recipient?.name ?? "Sem cadastro"}<small>{item.recipient?.email ?? item.recipient_email}</small></>],
      ["Situação", item => <TransferStatus transfer={item} />],
      ["Prazo", item => formatAdminDateTime(item.expires_at)],
    ],
  },
  audits: {
    load: listAdminAuditLogs, title: "Trilha de auditoria", description: "Consulte as operações e compare os valores anteriores e posteriores de cada registro.",
    filters: [
      { key: "event", label: "Evento", options: [["", "Todos os eventos"], ...Object.entries(auditEventLabels).map(([key, label]) => [key, label])] },
      { key: "user_id", label: "ID do autor", type: "number", min: 1 },
      { key: "auditable_id", label: "ID do registro", type: "number", min: 1 },
      { key: "date_from", label: "Data inicial (UTC)", type: "date" },
      { key: "date_to", label: "Data final (UTC)", type: "date" },
    ],
    sorts: [["-created_at", "Mais recentes"], ["created_at", "Mais antigos"], ["event", "Evento"]],
    columns: [
      ["Operação", item => <><strong>{item.summary}</strong><small>Evento #{item.id}</small></>],
      ["Autor", item => <>{item.user?.name ?? "Rotina do sistema"}<small>{item.user?.email}</small></>],
      ["Entidade", item => <>{item.entity}<small>Registro #{item.entity_id}</small></>],
      ["Data e hora (UTC)", item => formatAdminDateTime(item.created_at, "UTC")],
    ],
  },
};

export default function OperationTable({ kind, active, onOpen, refreshKey = 0, initialFilters = {} }) {
  const config = configs[kind];
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("-created_at");
  const [error, setError] = useState("");
  const loader = useCallback(() => config.load({ filters, page, sort }), [config, filters, page, sort]);
  const resource = useAdminResource(loader, { enabled: active, refreshKey });
  const { data } = resource;
  const clear = () => { setDraft({}); setFilters({}); setPage(1); setError(""); };

  return (
    <div className={styles.page}>
      <PageHeading as="h2" title={config.title} description={config.description}>
        <button className={styles.secondaryButton} disabled={resource.loading} onClick={resource.reload} type="button"><ArrowClockwiseIcon aria-hidden size={17} />Atualizar</button>
      </PageHeading>
      <section className={styles.panel} aria-label={config.title} aria-busy={active && resource.loading}>
        <form className={styles.filterForm} onSubmit={event => {
          event.preventDefault();
          const failure = getAdminFilterError(draft);
          setError(failure);
          if (failure) return;
          setFilters({ ...draft }); setPage(1);
        }}>
          <div className={styles.filterGrid}>
            {config.filters.map(({ key, label, options, type, ...props }) => type === "checkbox" ? (
              <label className={styles.check} key={key}><input checked={Boolean(draft[key])} onChange={event => setDraft({ ...draft, [key]: event.target.checked })} type="checkbox" />{label}</label>
            ) : (
              <Field as={options ? "select" : "input"} key={key} label={label} onChange={event => setDraft({ ...draft, [key]: event.target.value })} type={options ? undefined : type ?? "text"} value={draft[key] ?? ""} {...props}>
                {options?.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </Field>
            ))}
          </div>
          <Feedback error message={error} />
          <div className={styles.filterActions}>
            <div className={styles.rowActions}>
              <button className={styles.secondaryButton} type="submit"><MagnifyingGlassIcon aria-hidden size={17} />Filtrar</button>
              <button className={styles.textLink} onClick={clear} type="button">Limpar filtros</button>
            </div>
            <Field as="select" label="Ordenar por" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
              {config.sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Field>
          </div>
        </form>
        <ResourceState {...resource} retry={resource.reload}>
          {data && (data.items.length ? <>
            <p className={styles.resultCount} role="status">{data.total} {data.total === 1 ? "registro encontrado" : "registros encontrados"}</p>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr>{config.columns.map(([label]) => <th key={label} scope="col">{label}</th>)}<th scope="col">Detalhes</th></tr></thead>
                <tbody>{data.items.map(item => <tr key={item.id}>
                  {config.columns.map(([label, render]) => <td key={label}>{render(item)}</td>)}
                  <td><button aria-label={`Ver detalhes do registro ${item.id}`} className={styles.secondaryButton} onClick={() => onOpen(kind, item.id)} type="button">Ver detalhes<ArrowRightIcon aria-hidden size={16} /></button></td>
                </tr>)}</tbody>
              </table>
            </div>
            <Pagination data={data} disabled={resource.loading} onPage={setPage} />
          </> : <div className={styles.empty}><MagnifyingGlassIcon aria-hidden size={32} /><h3>Nenhum registro encontrado</h3><p>Ajuste os filtros ou atualize a consulta.</p><button className={styles.secondaryButton} onClick={clear} type="button">Limpar filtros</button></div>)}
        </ResourceState>
      </section>
    </div>
  );
}
