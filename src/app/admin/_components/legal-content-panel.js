"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { listAdminLegalDocuments } from "../../legal-api";
import { legalContent } from "../../lib/legal-content";
import { Feedback, PageHeading, ResourceState, useAdminResource } from "./admin-ui";
import styles from "../admin.module.css";

const LegalEditor = dynamic(() => import("./legal-editor"), { ssr: false, loading: () => <p role="status">Carregando editor…</p> });

export default function LegalContentPanel({ active }) {
  const [selected, setSelected] = useState("terms");
  const [feedback, setFeedback] = useState("");
  const resource = useAdminResource(listAdminLegalDocuments, { enabled: active });
  return (
    <div className={styles.page}>
      <PageHeading as="h2" description="Edite e publique os documentos exibidos no cadastro e no perfil dos usuários." title="Textos legais" />
      <div aria-label="Documento legal" className={styles.documentTabs} role="tablist">
        {Object.entries(legalContent).map(([type, document]) => (
          <button aria-controls={`legal-editor-panel-${type}`} aria-selected={type === selected} id={`legal-editor-tab-${type}`} key={type} onClick={() => setSelected(type)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? "terms" : event.key === "End" ? "privacy" : type === "terms" ? "privacy" : "terms";
            setSelected(next);
            event.currentTarget.parentElement.querySelector(`#legal-editor-tab-${next}`)?.focus();
          }} role="tab" tabIndex={type === selected ? 0 : -1} type="button">{document.title}</button>
        ))}
      </div>
      <Feedback message={feedback} />
      <ResourceState {...resource} keepContent retry={resource.reload}>
        {resource.data && Object.keys(legalContent).map(type => (
          <section aria-labelledby={`legal-editor-tab-${type}`} hidden={type !== selected} id={`legal-editor-panel-${type}`} key={type} role="tabpanel">
            <LegalEditor active={active && selected === type} document={resource.data[type]} onPublished={() => {
              setFeedback(`${legalContent[type].title}: documento publicado e disponível no aplicativo.`);
              resource.reload();
            }} type={type} />
          </section>
        ))}
      </ResourceState>
    </div>
  );
}
