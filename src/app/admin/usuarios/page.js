"use client";

import { useCallback, useState } from "react";
import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ActionButton from "../../components/action-button";
import { useAdminUser } from "../../components/admin-shell";
import {
  deleteInternalUser,
  getAdminErrorMessage,
  listInternalUsers,
} from "../admin-api";
import UserEditor from "../_components/user-editor";
import {
  ConfirmDialog,
  Feedback,
  Field,
  formatAdminDate,
  PageHeading,
  Pagination,
  ResourceState,
  useAdminResource,
} from "../_components/admin-ui";
import styles from "../admin.module.css";

export default function InternalUsersPage() {
  const currentUser = useAdminUser();
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState("name");
  const [query, setQuery] = useState({ search: "", searchBy: "name" });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const load = useCallback(
    () => listInternalUsers({ ...query, page, sort }),
    [query, page, sort],
  );
  const resource = useAdminResource(load);
  const { data } = resource;
  const saved = (message) => {
    setEditor(null);
    setFeedback(message);
    resource.reload();
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteInternalUser(deleting.id);
      setDeleting(null);
      setFeedback("Usuário interno excluído.");
      setPage(1);
      resource.reload();
    } catch (failure) {
      setError(getAdminErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeading
        description="Gerencie as contas que têm acesso à administração do LegadoCar."
        title="Usuários internos"
      >
        <ActionButton
          className={styles.compactButton}
          onClick={() => setEditor({ user: null })}
          type="button"
        >
          <PlusIcon aria-hidden size={18} />
          Novo usuário
        </ActionButton>
      </PageHeading>
      <Feedback message={feedback} />
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery({ search, searchBy });
            }}
          >
            <Field
              as="select"
              label="Buscar por"
              onChange={(event) => setSearchBy(event.target.value)}
              value={searchBy}
            >
              <option value="name">Nome</option>
              <option value="email">E-mail</option>
            </Field>
            <div className={styles.search}>
              <Field
                label={
                  searchBy === "name" ? "Nome do usuário" : "E-mail do usuário"
                }
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar na equipe"
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
            <option value="email">E-mail A–Z</option>
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
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Cadastrado em</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((user) => {
                        const protectedUser =
                          user.id === currentUser.id ||
                          user.document === "00000000000";
                        return (
                          <tr key={user.id}>
                            <td>
                              <strong>{user.name}</strong>
                              <small>
                                {user.document === "00000000000"
                                  ? "Administrador do sistema"
                                  : user.id === currentUser.id
                                    ? "Sua conta"
                                    : "Administrador"}
                              </small>
                            </td>
                            <td>{user.email}</td>
                            <td>{formatAdminDate(user.created_at)}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <button
                                  aria-label={`Editar ${user.name}`}
                                  className={styles.secondaryButton}
                                  onClick={() => setEditor({ user })}
                                  type="button"
                                >
                                  <PencilSimpleIcon aria-hidden size={16} />
                                  Editar
                                </button>
                                <button
                                  aria-label={`Excluir ${user.name}`}
                                  className={styles.iconButton}
                                  disabled={protectedUser}
                                  onClick={() => {
                                    setDeleting(user);
                                    setError("");
                                  }}
                                  title={
                                    protectedUser
                                      ? "A conta atual e o administrador do sistema são protegidos contra exclusão."
                                      : "Excluir usuário"
                                  }
                                  type="button"
                                >
                                  <TrashIcon aria-hidden size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination data={data} onPage={setPage} />
              </>
            ) : (
              <div className={styles.empty}>
                <UsersThreeIcon aria-hidden size={32} />
                <h2>
                  {query.search
                    ? "Nenhum usuário encontrado"
                    : "Nenhum usuário interno cadastrado"}
                </h2>
                <p>
                  {query.search
                    ? "Experimente outro nome ou e-mail."
                    : "Cadastre uma conta para integrar a equipe administrativa."}
                </p>
                {query.search && (
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSearch("");
                      setQuery({ search: "", searchBy });
                      setPage(1);
                    }}
                    type="button"
                  >
                    Limpar busca
                  </button>
                )}
              </div>
            ))}
        </ResourceState>
      </section>
      <section className={`${styles.panel} ${styles.card}`}>
        <h2>Usuários do aplicativo e moderação</h2>
        <p>
          A consulta e a moderação das contas do aplicativo ainda não estão
          disponíveis. Esta lista contém as contas administrativas.
        </p>
      </section>
      {editor && (
        <UserEditor
          onClose={() => setEditor(null)}
          onSaved={saved}
          user={editor.user}
        />
      )}
      {deleting && (
        <ConfirmDialog
          busy={busy}
          confirmLabel="Excluir usuário"
          description={`O acesso de ${deleting.name} será removido e os dados pessoais dessa conta serão anonimizados. Esta ação é definitiva.`}
          error={error}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          title="Excluir usuário interno?"
        />
      )}
    </div>
  );
}
