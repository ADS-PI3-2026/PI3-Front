"use client";

import { useState } from "react";
import { FileTextIcon } from "@phosphor-icons/react";
import { legalContent } from "../../lib/legal-content";
import { PageHeading } from "../_components/admin-ui";
import styles from "../admin.module.css";

export default function LegalContentPage() {
  const [selected, setSelected] = useState("terms");
  const document = legalContent[selected];
  const selectWithKeyboard = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "terms"
        : event.key === "End"
          ? "privacy"
          : selected === "terms"
            ? "privacy"
            : "terms";
    setSelected(next);
    event.currentTarget.parentElement
      .querySelector(`#legal-tab-${next}`)
      .focus();
  };

  return (
    <div className={styles.page}>
      <PageHeading
        description="Consulte os documentos apresentados no cadastro e na área de privacidade."
        title="Textos legais"
      />
      <div
        aria-label="Documentos legais"
        className={styles.documentTabs}
        role="tablist"
      >
        {Object.entries(legalContent).map(([key, content]) => (
          <button
            aria-controls={`legal-panel-${key}`}
            aria-selected={selected === key}
            id={`legal-tab-${key}`}
            key={key}
            onClick={() => setSelected(key)}
            onKeyDown={selectWithKeyboard}
            role="tab"
            tabIndex={selected === key ? 0 : -1}
            type="button"
          >
            {content.title}
          </button>
        ))}
      </div>
      <div className={styles.overviewLayout}>
        <article
          aria-labelledby={`legal-tab-${selected}`}
          className={`${styles.panel} ${styles.document}`}
          id={`legal-panel-${selected}`}
          role="tabpanel"
          tabIndex={0}
        >
          <h2>{document.title}</h2>
          <p className={styles.updated}>Atualizado em {document.updatedAt}</p>
          <p>{document.intro}</p>
          {document.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
        <aside className={`${styles.panel} ${styles.card}`}>
          <FileTextIcon aria-hidden color="#557aa6" size={28} />
          <h2 style={{ marginTop: 16 }}>Publicação de documentos</h2>
          <p>
            A edição e a publicação pelo painel ainda estão indisponíveis. Os
            documentos exibidos aqui correspondem à versão utilizada atualmente
            pelo aplicativo.
          </p>
        </aside>
      </div>
    </div>
  );
}
