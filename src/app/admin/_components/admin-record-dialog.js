"use client";

import { useCallback, useRef, useState } from "react";
import ActionButton from "../../components/action-button";
import { completeAdminTransfer, getAdminAuditLog, getAdminTransfer, getAdminUser, getAdminVehicle } from "../operations-api";
import { getAdminErrorMessage, getAdminFieldErrors } from "../admin-api";
import { auditEventLabels, formatAdminDateTime, formatAuditValue, getAuditChanges, getMediationBlockReason, getMediationConfirmation } from "../_lib/admin-operations";
import { Feedback, Field, Modal, ResourceState, useAdminResource } from "./admin-ui";
import { RecordStatus, TransferStatus } from "./operation-tables";
import styles from "../admin.module.css";

const titles = { users: "Usuário", vehicles: "Veículo", transfers: "Transferência", audits: "Evento de auditoria" };
const loaders = { users: getAdminUser, vehicles: getAdminVehicle, transfers: getAdminTransfer, audits: getAdminAuditLog };
const number = value => value == null ? "—" : Number(value).toLocaleString("pt-BR");
const vehicleTypes = { car: "Carro", truck: "Caminhão", motorcycle: "Motocicleta" };

function Details({ entries }) {
  return <dl className={styles.recordGrid}>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>;
}

function Relation({ title, record, type, onOpen, unavailable = "Registro indisponível" }) {
  return <section className={styles.relationCard}>
    <h3>{title}</h3>
    {record ? <>
      <strong>{record.name ?? `${record.brand} ${record.model}`}</strong>
      <p>{record.email ?? `${record.plate} · ${record.year}`}</p>
      {record.document && <p>{record.document_type?.toUpperCase()}: {record.document}</p>}
      {record.deleted_at && <RecordStatus deleted />}
      <button className={styles.textLink} onClick={() => onOpen(type, record.id)} type="button">Consultar {type === "users" ? "usuário" : "veículo"} #{record.id}</button>
    </> : <p>{unavailable}</p>}
  </section>;
}

function UserDetails({ user, onOpen }) {
  return <>
    <div className={styles.recordIntro}><div><h3>{user.name}</h3><p>{user.email}</p></div><RecordStatus deleted={user.is_deleted || user.deleted_at} /></div>
    <Details entries={[
      [user.document_type?.toUpperCase() || "Documento", user.document],
      ["Veículos vinculados", number(user.vehicles_count)],
      ["Cadastro", formatAdminDateTime(user.created_at)], ["Última atualização", formatAdminDateTime(user.updated_at)],
      ...(user.deleted_at ? [["Exclusão", formatAdminDateTime(user.deleted_at)]] : []),
    ]} />
    <section className={styles.recordSection}><h3>Veículos da conta</h3>
      {user.vehicles?.length ? <div className={styles.relatedList}>{user.vehicles.map(vehicle => <button className={styles.relatedItem} key={vehicle.id} onClick={() => onOpen("vehicles", vehicle.id)} type="button"><span><strong>{vehicle.brand} {vehicle.model}</strong><small>{vehicle.plate} · {vehicle.year}</small></span><span>Ver veículo →</span></button>)}</div> : <p className={styles.description}>Nenhum veículo vinculado a esta conta.</p>}
    </section>
  </>;
}

function VehicleDetails({ vehicle, onOpen }) {
  return <>
    <div className={styles.recordIntro}><div><h3>{vehicle.brand} {vehicle.model}</h3><p>{vehicle.plate} · {vehicle.year}</p></div><RecordStatus deleted={vehicle.deleted_at} /></div>
    <Details entries={[
      ["Tipo", vehicleTypes[vehicle.type] ?? vehicle.type], ["Cor", vehicle.color],
      ["Quilometragem", `${number(vehicle.mileage)} km`], ["RENAVAM cadastrado", vehicle.has_renavam ? "Sim" : "Não"],
      ["Manutenções", number(vehicle.maintenances_count)], ["Alertas de manutenção", number(vehicle.maintenance_alerts_count)],
      ["Transferências", number(vehicle.transfers_count)], ["Cadastro", formatAdminDateTime(vehicle.created_at)],
      ["Última atualização", formatAdminDateTime(vehicle.updated_at)],
      ...(vehicle.deleted_at ? [["Exclusão", formatAdminDateTime(vehicle.deleted_at)]] : []),
    ]} />
    <Relation title="Proprietário atual" record={vehicle.user} type="users" onOpen={onOpen} unavailable="Este veículo não possui proprietário vinculado." />
    {vehicle.active_transfer && <section className={styles.relationCard}><h3>Transferência em aberto</h3><p>#{vehicle.active_transfer.id} · Prazo: {formatAdminDateTime(vehicle.active_transfer.expires_at)}</p><button className={styles.textLink} onClick={() => onOpen("transfers", vehicle.active_transfer.id)} type="button">Consultar transferência →</button></section>}
  </>;
}

function TransferDetails({ transfer, vehicle, onOpen, busy, onBusy, onCompleted }) {
  const [editing, setEditing] = useState(false);
  const [renavam, setRenavam] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const locked = useRef(false);
  const blockReason = getMediationBlockReason(transfer, vehicle);
  const mediatable = ["pending", "expired"].includes(transfer.status);
  const submit = async event => {
    event.preventDefault();
    if (locked.current || !confirmed || blockReason) return;
    if (!renavam.replace(/\D/g, "")) { setFieldError("Informe o RENAVAM do veículo."); return; }
    locked.current = true; onBusy(true); setError(""); setFieldError("");
    try {
      await completeAdminTransfer(transfer.id, renavam);
      setEditing(false); setRenavam(""); setConfirmed(false);
      onCompleted();
    } catch (failure) {
      const fields = getAdminFieldErrors(failure);
      setFieldError(fields.renavam ?? "");
      setError(getAdminErrorMessage(failure));
    } finally { locked.current = false; onBusy(false); }
  };
  return <>
    <div className={styles.recordIntro}><div><h3>{transfer.vehicle?.plate ?? "Veículo indisponível"}</h3><p>{transfer.vehicle?.brand} {transfer.vehicle?.model}</p></div><TransferStatus transfer={transfer} /></div>
    <Details entries={[
      ["Solicitado por", transfer.initiated_by === "owner" ? "Proprietário" : "Comprador"],
      ["Solicitação", formatAdminDateTime(transfer.created_at)], ["Prazo de confirmação", formatAdminDateTime(transfer.expires_at)],
      ["Tentativas incorretas", number(transfer.failed_attempts)],
      ["Confirmação do proprietário", transfer.owner_validated_at ? formatAdminDateTime(transfer.owner_validated_at) : "Não confirmada"],
      ["Confirmação do destinatário", transfer.recipient_validated_at ? formatAdminDateTime(transfer.recipient_validated_at) : "Não confirmada"],
      ["Última atualização", formatAdminDateTime(transfer.updated_at)],
      ["E-mail informado na solicitação", transfer.recipient_email],
    ]} />
    <fieldset className={styles.relations} disabled={busy}>
      <Relation title="Proprietário de origem" record={transfer.current_owner} type="users" onOpen={onOpen} />
      <Relation title="Destinatário" record={transfer.recipient} type="users" onOpen={onOpen} unavailable={`Sem conta disponível · ${transfer.recipient_email}`} />
      <Relation title="Veículo" record={transfer.vehicle} type="vehicles" onOpen={onOpen} />
    </fieldset>
    {mediatable && <section className={styles.mediationSection}>
      <h3>Conclusão por mediação</h3>
      {blockReason ? <p className={styles.description}>{blockReason}</p> : <>
        <p className={styles.description}>Esta ação transfere o veículo para {transfer.recipient.name}, cancela outras solicitações pendentes para o mesmo veículo e notifica os envolvidos por e-mail.{vehicle.deleted_at ? " O veículo excluído será restaurado." : ""}</p>
        {vehicle.user_id !== transfer.current_owner_id && <p className={styles.description}>A custódia atual pertence a {vehicle.user?.name ?? `usuário #${vehicle.user_id}`}. Confira os dados antes de prosseguir.</p>}
        {!editing ? <button className={styles.secondaryButton} onClick={() => setEditing(true)} type="button">Concluir por mediação</button> : <form className={styles.form} onSubmit={submit}>
          <Field autoComplete="off" disabled={busy} error={fieldError} inputMode="numeric" label="RENAVAM do veículo" maxLength={20} onChange={event => setRenavam(event.target.value)} placeholder="Digite o RENAVAM para validar" required value={renavam} />
          <label className={styles.check}><input checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} required type="checkbox" />{getMediationConfirmation(transfer)}</label>
          <Feedback error message={error} />
          <div className={styles.actions}>
            <button className={styles.secondaryButton} disabled={busy} onClick={() => { setEditing(false); setRenavam(""); setConfirmed(false); setError(""); setFieldError(""); }} type="button">Voltar</button>
            <ActionButton className={styles.compactButton} disabled={busy || !confirmed || !renavam.trim()} type="submit">{busy ? "Concluindo…" : "Confirmar transferência"}</ActionButton>
          </div>
        </form>}
      </>}
    </section>}
  </>;
}

function AuditDetails({ log }) {
  const changes = getAuditChanges(log.old_values, log.new_values);
  return <>
    <div className={styles.recordIntro}><div><h3>{log.summary}</h3><p>{formatAdminDateTime(log.created_at, "UTC")}</p></div></div>
    <Details entries={[
      ["Evento", auditEventLabels[log.event] ?? log.event], ["Registro", `${log.entity} #${log.entity_id}`],
      ["Autor", log.user?.name ?? "Rotina do sistema"], ["E-mail do autor", log.user?.email],
      ["Endereço IP", log.ip_address], ["Navegador / agente", log.user_agent],
    ]} />
    <section className={styles.recordSection}><h3>Alterações registradas</h3>
      {changes.length ? <div className={styles.tableScroll}><table className={`${styles.table} ${styles.diffTable}`}><thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead><tbody>{changes.map(change => <tr key={change.key}><th scope="row"><code>{change.key}</code></th><td><pre>{formatAuditValue(change.before)}</pre></td><td><pre>{formatAuditValue(change.after)}</pre></td></tr>)}</tbody></table></div> : <p className={styles.description}>Nenhuma alteração de valor disponível para exibição.</p>}
    </section>
  </>;
}

export default function AdminRecordDialog({ kind, id, onClose, onOpen, onBack, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    const record = await loaders[kind](id);
    const vehicle = kind === "transfers" && record.vehicle ? await getAdminVehicle(record.vehicle_id) : null;
    return { record, vehicle };
  }, [kind, id]);
  const resource = useAdminResource(load);
  const record = resource.data?.record;
  return <Modal title={`${titles[kind]} #${id}`} wide busy={busy} onClose={onClose}>
    <div className={styles.recordBody}>
      {onBack && <button className={styles.textLink} disabled={busy} onClick={onBack} type="button">← Voltar ao registro anterior</button>}
      <Feedback message={feedback} />
      <ResourceState {...resource} retry={resource.reload}>
        {record && <>
          {kind === "users" && <UserDetails user={record} onOpen={onOpen} />}
          {kind === "vehicles" && <VehicleDetails vehicle={record} onOpen={onOpen} />}
          {kind === "transfers" && <TransferDetails transfer={record} vehicle={resource.data.vehicle} onOpen={onOpen} busy={busy} onBusy={setBusy} onCompleted={() => { setFeedback("Transferência concluída. A custódia do veículo foi atualizada."); resource.reload(); onChanged(); }} />}
          {kind === "audits" && <AuditDetails log={record} />}
        </>}
      </ResourceState>
      <div className={styles.actions}><button className={styles.secondaryButton} disabled={busy || resource.loading} onClick={resource.reload} type="button">Atualizar dados</button><button className={styles.secondaryButton} disabled={busy} onClick={onClose} type="button">Fechar</button></div>
    </div>
  </Modal>;
}
