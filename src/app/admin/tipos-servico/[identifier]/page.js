"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ArrowLeftIcon,
  PencilSimpleIcon,
  PlusIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import ActionButton from "../../../components/action-button";
import {
  deleteAdminServiceType,
  getAdminErrorMessage,
  getAdminServiceType,
  listServiceFields,
  setServiceFieldActive,
} from "../../admin-api";
import ServiceEditor from "../../_components/service-editor";
import FieldEditor, { fieldTypes } from "../../_components/field-editor";
import {
  ConfirmDialog,
  Feedback,
  PageHeading,
  ResourceState,
  Status,
  useAdminResource,
} from "../../_components/admin-ui";
import styles from "../../admin.module.css";
import { decodeServiceIdentifier } from "../../_lib/admin-forms";

function ServiceTypeDetail({ identifier }) {
  const router = useRouter();
  const load = useCallback(async () => {
    const [service, fields] = await Promise.all([
      getAdminServiceType(identifier),
      listServiceFields(identifier),
    ]);
    return { service, fields };
  }, [identifier]);
  const resource = useAdminResource(load);
  const [editor, setEditor] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [pendingField, setPendingField] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data } = resource;
  const savedField = (message) => {
    setEditor(null);
    setFeedback(message);
    resource.reload();
  };

  const toggleField = async (field) => {
    if (pendingField != null) return;
    setPendingField(field.id);
    setError("");
    try {
      await setServiceFieldActive(identifier, field.id, !field.is_active);
      setFeedback(field.is_active ? "Campo desativado." : "Campo ativado.");
      resource.reload();
    } catch (failure) {
      setError(getAdminErrorMessage(failure));
    } finally {
      setPendingField(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminServiceType(identifier);
      router.push("/admin/tipos-servico");
    } catch (failure) {
      setError(getAdminErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link className={styles.textLink} href="/admin/tipos-servico">
        <ArrowLeftIcon aria-hidden size={17} />
        Tipos de serviço
      </Link>
      <PageHeading
        description="Defina os dados que serão solicitados ao registrar uma manutenção."
        title={data?.service.name ?? "Gerenciar tipo de serviço"}
      >
        {data && <Status active={data.service.is_active} />}
      </PageHeading>
      <Feedback message={feedback} />
      {!deleting && <Feedback error message={error} />}
      <ResourceState {...resource} keepContent retry={resource.reload}>
        {data && (
          <div aria-busy={resource.loading} className={styles.detailLayout}>
            <div className={styles.detailSidebar}>
              <section className={styles.panel}>
                <header className={styles.panelHeading}>
                  <h2>Dados do tipo de serviço</h2>
                </header>
                <div className={styles.panelBody}>
                  <ServiceEditor
                    onSaved={() => {
                      setFeedback("Tipo de serviço atualizado.");
                      resource.reload();
                    }}
                    service={data.service}
                  />
                </div>
                <div className={styles.dangerPanel}>
                  <h3>Excluir tipo de serviço</h3>
                  <p>
                    A exclusão também remove os campos deste tipo de serviço.
                    Para suspender novos registros, desative a disponibilidade.
                  </p>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setDeleting(true);
                      setError("");
                    }}
                    type="button"
                  >
                    Excluir tipo de serviço
                  </button>
                </div>
              </section>
            </div>
            <section className={styles.panel}>
              <header className={styles.panelHeading}>
                <div>
                  <h2>Campos do formulário</h2>
                  <p>
                    {data.fields.length}{" "}
                    {data.fields.length === 1
                      ? "campo configurado"
                      : "campos configurados"}
                  </p>
                </div>
                <ActionButton
                  className={styles.compactButton}
                  disabled={resource.loading || Boolean(resource.error)}
                  onClick={() => setEditor({ field: null })}
                  type="button"
                >
                  <PlusIcon aria-hidden size={17} />
                  Novo campo
                </ActionButton>
              </header>
              {data.fields.length ? (
                <div className={styles.fieldList}>
                  {data.fields.map((field) => (
                    <article className={styles.fieldRow} key={field.id}>
                      <div>
                        <h3>{field.display_name}</h3>
                        <p>
                          {fieldTypes.find(
                            ([value]) => value === field.field_type,
                          )?.[1] ?? field.field_type}{" "}
                          · Ordem {field.order}
                          <br />
                          <span className={styles.identifier}>
                            {field.name}
                          </span>
                        </p>
                        {field.description && <p>{field.description}</p>}
                        <div className={styles.fieldMeta}>
                          <Status active={field.is_active} />
                          {field.required && (
                            <span className={styles.tag}>Obrigatório</span>
                          )}
                          {!field.required &&
                            field.required_if_field_filled && (
                              <span className={styles.tag}>
                                Obrigatório por condição
                              </span>
                            )}
                        </div>
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          aria-label={`Editar ${field.display_name}`}
                          className={styles.iconButton}
                          disabled={
                            pendingField != null ||
                            resource.loading ||
                            Boolean(resource.error)
                          }
                          onClick={() => setEditor({ field })}
                          title="Editar campo"
                          type="button"
                        >
                          <PencilSimpleIcon aria-hidden size={19} />
                        </button>
                        <button
                          aria-label={`${field.is_active ? "Desativar" : "Ativar"} ${field.display_name}`}
                          className={styles.secondaryButton}
                          disabled={
                            pendingField != null ||
                            resource.loading ||
                            Boolean(resource.error)
                          }
                          onClick={() => toggleField(field)}
                          type="button"
                        >
                          {field.is_active ? (
                            <ToggleRightIcon aria-hidden size={19} />
                          ) : (
                            <ToggleLeftIcon aria-hidden size={19} />
                          )}
                          {pendingField === field.id
                            ? "Salvando…"
                            : field.is_active
                              ? "Desativar"
                              : "Ativar"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <WrenchIcon aria-hidden size={32} />
                  <h3>Adicione os detalhes do serviço</h3>
                  <p>
                    Crie campos como oficina responsável, marca da peça ou itens
                    verificados.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </ResourceState>
      {editor && data && (
        <FieldEditor
          field={editor.field}
          fields={data.fields}
          identifier={identifier}
          onClose={() => setEditor(null)}
          onSaved={savedField}
        />
      )}
      {deleting && (
        <ConfirmDialog
          busy={busy}
          confirmLabel="Excluir tipo de serviço"
          description={`O tipo de serviço “${data.service.name}” e seus campos serão excluídos. Esta ação é definitiva e pode ser impedida quando houver manutenções vinculadas.`}
          error={error}
          onClose={() => setDeleting(false)}
          onConfirm={remove}
          title="Excluir tipo de serviço?"
        />
      )}
    </div>
  );
}

export default function ServiceTypePage() {
  const params = useParams();
  const identifier = decodeServiceIdentifier(params.identifier);
  return <ServiceTypeDetail identifier={identifier} key={identifier} />;
}
