"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  ClipboardTextIcon,
  FileTextIcon,
  PlusIcon,
  UsersThreeIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { useAdminUser } from "../components/admin-shell";
import { listAdminServiceTypes, listInternalUsers } from "./admin-api";
import {
  PageHeading,
  ResourceState,
  Status,
  useAdminResource,
} from "./_components/admin-ui";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const user = useAdminUser();
  const load = useCallback(async () => {
    const [users, services, activeServices] = await Promise.all([
      listInternalUsers(),
      listAdminServiceTypes(),
      listAdminServiceTypes({ status: "1" }),
    ]);
    return { users, services, activeServices };
  }, []);
  const resource = useAdminResource(load);
  const { data } = resource;

  return (
    <div className={styles.page}>
      <PageHeading
        description="Acompanhe o catálogo e gerencie os acessos da equipe."
        title={`Olá, ${user.name.trim().split(/\s+/)[0]}`}
      >
        <Link
          className={styles.secondaryButton}
          href="/admin/tipos-servico?novo=1"
        >
          <PlusIcon aria-hidden size={18} />
          Novo tipo de serviço
        </Link>
      </PageHeading>
      <ResourceState {...resource} retry={resource.reload}>
        {data && (
          <>
            <section
              aria-label="Resumo administrativo"
              className={styles.stats}
            >
              <Link
                className={`${styles.panel} ${styles.stat}`}
                href="/admin/usuarios"
              >
                <header>
                  <span>Usuários internos</span>
                  <UsersThreeIcon aria-hidden size={23} />
                </header>
                <strong>{data.users.total}</strong>
              </Link>
              <Link
                className={`${styles.panel} ${styles.stat}`}
                href="/admin/tipos-servico"
              >
                <header>
                  <span>Tipos de serviço</span>
                  <WrenchIcon aria-hidden size={23} />
                </header>
                <strong>{data.services.total}</strong>
              </Link>
              <Link
                className={`${styles.panel} ${styles.stat}`}
                href="/admin/tipos-servico?status=1"
              >
                <header>
                  <span>Serviços ativos</span>
                  <WrenchIcon aria-hidden size={23} />
                </header>
                <strong>{data.activeServices.total}</strong>
              </Link>
            </section>
            <div className={styles.overviewLayout}>
              <section className={styles.panel}>
                <header className={styles.panelHeading}>
                  <div>
                    <h2>Catálogo de serviços</h2>
                    <p>Categorias disponíveis para organizar as manutenções.</p>
                  </div>
                  <Link className={styles.textLink} href="/admin/tipos-servico">
                    Ver todos
                    <ArrowRightIcon aria-hidden size={16} />
                  </Link>
                </header>
                {data.services.items.length ? (
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Tipo de serviço</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.services.items.slice(0, 6).map((service) => (
                          <tr key={service.identifier}>
                            <td>
                              <strong>{service.name}</strong>
                              <small>
                                {service.description || service.identifier}
                              </small>
                            </td>
                            <td>
                              <Status active={service.is_active} />
                            </td>
                            <td>
                              <Link
                                className={styles.textLink}
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
                ) : (
                  <div className={styles.empty}>
                    <WrenchIcon aria-hidden size={32} />
                    <h3>Seu catálogo começa aqui</h3>
                    <p>
                      Cadastre o primeiro tipo de serviço e os campos que serão
                      preenchidos nas manutenções.
                    </p>
                    <Link
                      className={styles.textLink}
                      href="/admin/tipos-servico?novo=1"
                    >
                      Cadastrar tipo de serviço
                      <ArrowRightIcon aria-hidden size={16} />
                    </Link>
                  </div>
                )}
              </section>
              <div className={styles.stack}>
                <section className={`${styles.panel} ${styles.card}`}>
                  <h2>Sua conta administrativa</h2>
                  <p>
                    <strong>{user.name}</strong>
                    <br />
                    {user.email}
                  </p>
                  <Link className={styles.textLink} href="/admin/usuarios">
                    Gerenciar equipe
                    <ArrowRightIcon aria-hidden size={16} />
                  </Link>
                </section>
                <section className={styles.panel}>
                  <header className={styles.panelHeading}>
                    <h2>Outros módulos</h2>
                  </header>
                  {[
                    {
                      href: "/admin/conteudos-legais",
                      title: "Textos legais",
                      description: "Consultar documentos atuais",
                      Icon: FileTextIcon,
                    },
                    {
                      href: "/admin/mediacoes",
                      title: "Mediações",
                      description: "Disponibilidade do acompanhamento",
                      Icon: ArrowsLeftRightIcon,
                    },
                    {
                      href: "/admin/auditoria",
                      title: "Auditoria",
                      description: "Disponibilidade da consulta",
                      Icon: ClipboardTextIcon,
                    },
                  ].map(({ href, title, description, Icon }) => (
                    <Link className={styles.moduleLink} href={href} key={href}>
                      <Icon aria-hidden size={22} />
                      <div>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </div>
                      <ArrowRightIcon aria-hidden size={16} />
                    </Link>
                  ))}
                </section>
              </div>
            </div>
          </>
        )}
      </ResourceState>
    </div>
  );
}
