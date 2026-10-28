"use client";

import {
  ArrowsLeftRight,
  ChartBar,
  ClipboardText,
  FileText,
  ShieldCheck,
  UsersThree,
  Wrench,
} from "@phosphor-icons/react";
import AdminShell, { useAdminUser } from "../components/admin-shell";
import styles from "./page.module.css";

const plannedModules = [
  {
    title: "Usuários e moderação",
    description: "Gerenciamento de contas internas e acompanhamento dos usuários da plataforma.",
    Icon: UsersThree,
  },
  {
    title: "Tipos de serviço",
    description: "Organização das categorias e dos campos utilizados nos registros de manutenção.",
    Icon: Wrench,
  },
  {
    title: "Textos legais",
    description: "Edição e publicação dos Termos de Uso e da Política de Privacidade.",
    Icon: FileText,
  },
  {
    title: "Mediações técnicas",
    description: "Acompanhamento de transferências pendentes que precisem de intervenção administrativa.",
    Icon: ArrowsLeftRight,
  },
  {
    title: "Trilha de auditoria",
    description: "Consulta futura dos registros de alterações e exclusões realizadas na plataforma.",
    Icon: ClipboardText,
  },
];

function AdminDashboard() {
  const user = useAdminUser();
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <div className={styles.dashboard}>
      <section className={styles.introduction}>
        <div>
          <p>Visão geral</p>
          <h1>Olá, {firstName}</h1>
          <span>Esta é a área reservada para a administração do LegadoCar.</span>
        </div>
        <div className={styles.restrictedBadge}>
          <ShieldCheck aria-hidden size={22} weight="duotone" />
          Acesso administrativo
        </div>
      </section>

      <section aria-labelledby="admin-modules-title" className={styles.modulesSection}>
        <header>
          <div>
            <p>Estrutura inicial</p>
            <h2 id="admin-modules-title">Módulos previstos</h2>
          </div>
          <ChartBar aria-hidden size={28} weight="duotone" />
        </header>

        <div className={styles.moduleGrid}>
          {plannedModules.map(({ title, description, Icon }) => (
            <article className={styles.moduleCard} key={title}>
              <span className={styles.moduleIcon}>
                <Icon aria-hidden size={25} weight="duotone" />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <small>Planejado</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.nextSteps}>
        <div>
          <h2>Página inicial provisória</h2>
          <p>
            Os indicadores e as operações administrativas serão adicionados quando seus contratos e prioridades forem definidos pela equipe.
          </p>
        </div>
        <ChartBar aria-hidden size={32} weight="duotone" />
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminShell>
      <AdminDashboard />
    </AdminShell>
  );
}
