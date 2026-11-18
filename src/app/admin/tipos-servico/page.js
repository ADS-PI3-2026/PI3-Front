"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import { listAdminServiceTypes } from "../admin-api";
import ServiceEditor from "../_components/service-editor";
import {
  Field,
  Modal,
  PageHeading,
  Pagination,
  ResourceState,
  Status,
  useAdminResource,
} from "../_components/admin-ui";
import styles from "../admin.module.css";

function ServiceTypesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(
    ["0", "1"].includes(params.get("status")) ? params.get("status") : "",
  );
  const [sort, setSort] = useState("name");
  const [creating, setCreating] = useState(params.get("novo") === "1");
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    () => listAdminServiceTypes({ page, search: query, status, sort }),
    [page, query, status, sort],
  );
  const resource = useAdminResource(load);
  const { data } = resource;

  const closeEditor = () => {
    setCreating(false);
    if (params.has("novo"))
      router.replace("/admin/tipos-servico", { scroll: false });
  };

  return (
    <div className={styles.page}>
      <PageHeading
        description="Organize as categorias e os campos utilizados nos registros de manutenção."
        title="Tipos de serviço"
      >
        <ActionButton
          className={styles.compactButton}
          onClick={() => setCreating(true)}
          type="button"
        >
          <PlusIcon aria-hidden size={18} />
          Novo tipo de serviço
        </ActionButton>
      </PageHeading>
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search);
              setPage(1);
            }}
          >
            <div className={styles.search}>
              <Field
                label="Nome do tipo de serviço"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no catálogo"
                value={search}
              />
            </div>
            <button className={styles.secondaryButton} type="submit">
              <MagnifyingGlassIcon aria-hidden size={17} />
              Buscar
            </button>
          </form>
          <Field
            as="select"
            label="Status"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="">Todos</option>
            <option value="1">Ativos</option>
            <option value="0">Inativos</option>
          </Field>
          <Field
            as="select"
            label="Ordenar por"
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            value={sort}
          >
            <option value="name">Nome A–Z</option>
            <option value="-name">Nome Z–A</option>
            <option value="-created_at">Mais recentes</option>
          </Field>
        </div>
        <ResourceState {...resource} retry={resource.reload}>
          {data &&
            (data.items.length ? (
              <>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tipo de serviço</th>
                        <th>Identificador</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((service) => (
                        <tr key={service.identifier}>
                          <td>
                            <strong>{service.name}</strong>
                            <small>{service.description}</small>
                          </td>
                          <td>
                            <code>{service.identifier}</code>
                          </td>
                          <td>
                            <Status active={service.is_active} />
                          </td>
                          <td>
                            <Link
                              className={styles.secondaryButton}
                              href={`/admin/tipos-servico/${encodeURIComponent(service.identifier)}`}
                            >
                              Gerenciar
                              <ArrowRightIcon aria-hidden size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination data={data} onPage={setPage} />
              </>
            ) : (
              <div className={styles.empty}>
                <WrenchIcon aria-hidden size={36} />
                <h2>
                  {query || status
                    ? "Nenhum tipo de serviço encontrado"
                    : "Cadastre o primeiro tipo de serviço"}
                </h2>
                <p>
                  {query || status
                    ? "Ajuste a busca ou os filtros para consultar o catálogo."
                    : "Depois do cadastro, você poderá configurar os campos das manutenções."}
                </p>
                {query || status ? (
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSearch("");
                      setQuery("");
                      setStatus("");
                      setPage(1);
                    }}
                    type="button"
                  >
                    Limpar filtros
                  </button>
                ) : (
                  <ActionButton
                    className={styles.compactButton}
                    onClick={() => setCreating(true)}
                    type="button"
                  >
                    <PlusIcon aria-hidden size={18} />
                    Cadastrar tipo de serviço
                  </ActionButton>
                )}
              </div>
            ))}
        </ResourceState>
      </section>
      {creating && (
        <Modal busy={saving} onClose={closeEditor} title="Novo tipo de serviço">
          <ServiceEditor
            onBusyChange={setSaving}
            onCancel={closeEditor}
            onSaved={(service) => {
              setCreating(false);
              router.push(
                `/admin/tipos-servico/${encodeURIComponent(service.identifier)}`,
              );
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default function ServiceTypesPage() {
  return (
    <Suspense fallback={<p role="status">Carregando catálogo…</p>}>
      <ServiceTypesContent />
    </Suspense>
  );
}
