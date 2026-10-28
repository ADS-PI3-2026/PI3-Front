"use client";

import { FileText, ShieldCheck } from "@phosphor-icons/react";
import AdminShell from "../../components/admin-shell";
import styles from "./page.module.css";

const documents = [
  {
    title: "Termos de Uso",
    description: "Condições gerais para cadastro e utilização do LegadoCar.",
  },
  {
    title: "Política de Privacidade",
    description: "Informações sobre coleta, tratamento e proteção dos dados pessoais.",
  },
];

export default function LegalContentPage() {
  return (
    <AdminShell>
      <div className={styles.page}>
        <header className={styles.heading}>
          <div>
            <p>Conteúdo institucional</p>
            <h1>Textos legais</h1>
            <span>Gerencie os documentos apresentados aos usuários do LegadoCar.</span>
          </div>
          <FileText aria-hidden size={34} weight="duotone" />
        </header>

        <section aria-labelledby="legal-documents-title" className={styles.documentsSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Documentos utilizados atualmente</p>
              <h2 id="legal-documents-title">Publicação e edição</h2>
            </div>
            <ShieldCheck aria-hidden size={27} weight="duotone" />
          </div>

          <div className={styles.documentList}>
            {documents.map((document) => (
              <article className={styles.documentCard} key={document.title}>
                <span className={styles.documentIcon}>
                  <FileText aria-hidden size={24} weight="duotone" />
                </span>
                <div>
                  <h3>{document.title}</h3>
                  <p>{document.description}</p>
                </div>
                <span className={styles.status}>Preparando edição</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.information}>
          <ShieldCheck aria-hidden size={26} weight="duotone" />
          <div>
            <h2>Área em preparação</h2>
            <p>
              Quando a edição for habilitada, os textos publicados aqui serão exibidos automaticamente no cadastro e na área de privacidade dos usuários.
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
