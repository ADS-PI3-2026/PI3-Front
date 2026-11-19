"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicLegalDocument } from "../legal-api";
import { getAuthErrorMessage } from "../auth-api";
import { formatLegalDate } from "../lib/legal-html";
import styles from "./legal-rich-text.module.css";

export default function LegalDocument({ type }) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ type, loading: true, document: null, error: "" });
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      if (!active) return;
      setState({ type, loading: true, document: null, error: "" });
      try {
        const document = await getPublicLegalDocument(type);
        if (active) setState({ type, loading: false, document, error: "" });
      } catch (error) {
        if (active) setState({ type, loading: false, document: null, error: getAuthErrorMessage(error, "Não foi possível carregar o documento.") });
      }
    });
    return () => { active = false; };
  }, [type, revision]);

  if (state.type !== type || state.loading) return <p role="status">Carregando documento…</p>;
  if (state.error) return <div className={styles.error}><p role="alert">{state.error}</p><button onClick={retry} type="button">Tentar novamente</button></div>;
  return <>
    <div className={styles.prose} dangerouslySetInnerHTML={{ __html: state.document.html }} />
    {state.document.updatedAt && <p className={styles.updated}>Última atualização: {formatLegalDate(state.document.updatedAt)}</p>}
  </>;
}
