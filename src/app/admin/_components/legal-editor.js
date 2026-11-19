"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextExtension, $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { HistoryExtension } from "@lexical/history";
import { ClipboardDOMImportExtension } from "@lexical/clipboard";
import { ListExtension, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { LinkExtension, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $generateHtmlFromNodes, $generateNodesFromDOMViaExtension } from "@lexical/html";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import { $createParagraphNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_LOW, defineExtension, FORMAT_TEXT_COMMAND, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { ArrowCounterClockwiseIcon, ArrowClockwiseIcon, LinkIcon, ListBulletsIcon, ListNumbersIcon, TextBolderIcon, TextItalicIcon, TextUnderlineIcon } from "@phosphor-icons/react";
import { saveAdminLegalDocument } from "../../legal-api";
import { formatLegalDate, hasLegalText, sanitizeLegalHtml } from "../../lib/legal-html";
import { getAdminErrorMessage } from "../admin-api";
import { Feedback, Modal } from "./admin-ui";
import textStyles from "../../components/legal-rich-text.module.css";
import styles from "./legal-editor.module.css";

function EditorSurface({ active, document, type, onPublished, onDirtyChange }) {
  const [editor] = useLexicalComposerContext();
  const baseline = useRef(null);
  const expectedDocument = useRef(document.html);
  const previewButton = useRef(null);
  const [html, setHtml] = useState(document.html);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [formats, setFormats] = useState({});
  const [block, setBlock] = useState("paragraph");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    baseline.current = editor.read("latest", () => sanitizeLegalHtml($generateHtmlFromNodes(editor)));
    return mergeRegister(
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            setFormats(Object.fromEntries(["bold", "italic", "underline"].map(format => [format, selection.hasFormat(format)])));
            const element = selection.anchor.getNode().getTopLevelElement();
            setBlock($isHeadingNode(element) ? element.getTag() : "paragraph");
          }
          if (!dirtyElements.size && !dirtyLeaves.size) return;
          const next = sanitizeLegalHtml($generateHtmlFromNodes(editor));
          setHtml(next);
          const changed = next !== baseline.current;
          setDirty(changed);
          onDirtyChange(changed);
        });
      }),
      editor.registerCommand(CAN_UNDO_COMMAND, value => { setCanUndo(value); return false; }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(CAN_REDO_COMMAND, value => { setCanRedo(value); return false; }, COMMAND_PRIORITY_LOW),
    );
  }, [editor, onDirtyChange]);

  useEffect(() => { editor.setEditable(!busy); }, [busy, editor]);
  useEffect(() => {
    if (!active) queueMicrotask(() => setPreview(false));
  }, [active]);

  const publish = async (event) => {
    event.preventDefault();
    if (busy) return;
    const next = editor.read("latest", () => sanitizeLegalHtml($generateHtmlFromNodes(editor)));
    setError("");
    if (!hasLegalText(next)) { setError("Escreva o conteúdo do documento antes de publicar."); return; }
    setBusy(true);
    try {
      await saveAdminLegalDocument(type, next, { expectedHtml: expectedDocument.current });
      baseline.current = next;
      expectedDocument.current = next;
      setHtml(next);
      setDirty(false);
      onDirtyChange(false);
      onPublished();
    } catch (failure) {
      setError(getAdminErrorMessage(failure));
    } finally { setBusy(false); }
  };

  const toolbarButton = (label, Icon, command, payload, pressed, disabled = false) => (
    <button aria-label={label} aria-pressed={pressed} disabled={busy || preview || disabled} onMouseDown={event => event.preventDefault()} onClick={() => editor.dispatchCommand(command, payload)} title={label} type="button">
      <Icon aria-hidden size={20} />
    </button>
  );
  const applyLink = () => {
    if (busy || !/^(https?:\/\/|mailto:|tel:)/i.test(link.trim())) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url: link.trim(), target: "_blank", rel: "noopener noreferrer" });
    setLinkOpen(false);
    editor.focus();
  };
  const closePreview = () => {
    setPreview(false);
    requestAnimationFrame(() => previewButton.current?.focus());
  };

  return (
    <form className={styles.form} onSubmit={publish}>
      <div className={styles.editorHeading}>
        <div>
          <h3>{document.title}</h3>
          <p>{document.updatedAt ? `Última publicação em ${formatLegalDate(document.updatedAt)}` : "Documento público"}</p>
        </div>
        <button aria-expanded={preview} aria-haspopup="dialog" className={styles.previewButton} disabled={busy} ref={previewButton} onClick={() => {
          setHtml(editor.read("latest", () => sanitizeLegalHtml($generateHtmlFromNodes(editor))));
          setLinkOpen(false);
          setPreview(true);
        }} type="button">Visualizar prévia</button>
      </div>
      <div className={styles.editor}>
        <div aria-label="Formatação do documento" className={styles.toolbar} role="toolbar">
          <select aria-label="Formato do parágrafo" disabled={busy || preview} onChange={event => {
            const value = event.target.value;
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => value === "paragraph" ? $createParagraphNode() : $createHeadingNode(value));
            });
            editor.focus();
          }} value={block}>
            <option value="paragraph">Parágrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option>
          </select>
          {toolbarButton("Negrito", TextBolderIcon, FORMAT_TEXT_COMMAND, "bold", Boolean(formats.bold))}
          {toolbarButton("Itálico", TextItalicIcon, FORMAT_TEXT_COMMAND, "italic", Boolean(formats.italic))}
          {toolbarButton("Sublinhado", TextUnderlineIcon, FORMAT_TEXT_COMMAND, "underline", Boolean(formats.underline))}
          <span aria-hidden className={styles.divider} />
          {toolbarButton("Lista com marcadores", ListBulletsIcon, INSERT_UNORDERED_LIST_COMMAND)}
          {toolbarButton("Lista numerada", ListNumbersIcon, INSERT_ORDERED_LIST_COMMAND)}
          <button aria-label="Inserir ou remover link" aria-expanded={linkOpen} disabled={busy || preview} onMouseDown={event => event.preventDefault()} onClick={() => setLinkOpen(value => !value)} title="Inserir ou remover link" type="button"><LinkIcon aria-hidden size={20} /></button>
          <span aria-hidden className={styles.divider} />
          {toolbarButton("Desfazer", ArrowCounterClockwiseIcon, UNDO_COMMAND, undefined, undefined, !canUndo)}
          {toolbarButton("Refazer", ArrowClockwiseIcon, REDO_COMMAND, undefined, undefined, !canRedo)}
        </div>
        {linkOpen && !preview && <div className={styles.linkRow}>
          <label>Endereço do link<input disabled={busy} inputMode="url" onChange={event => setLink(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); applyLink(); }
          }} placeholder="https://exemplo.com" type="text" value={link} /></label>
          <button disabled={busy || !/^(https?:\/\/|mailto:|tel:)/i.test(link.trim())} onClick={applyLink} type="button">Aplicar</button>
          <button disabled={busy} onClick={() => { editor.dispatchCommand(TOGGLE_LINK_COMMAND, null); setLinkOpen(false); editor.focus(); }} type="button">Remover link</button>
        </div>}
        <ContentEditable aria-label={`Conteúdo de ${document.title}`} aria-multiline className={`${styles.editable} ${textStyles.prose}`} spellCheck />
      </div>
      <Feedback error message={error} />
      <footer className={styles.footer}>
        <p>{dirty ? "Alterações ainda não publicadas." : "O conteúdo publicado fica disponível no cadastro e no perfil."}</p>
        <button className={styles.publishButton} disabled={busy || !dirty} type="submit">{busy ? "Publicando…" : "Publicar alterações"}</button>
      </footer>
      {active && preview && (
        <Modal onClose={closePreview} title={document.title} wide>
          <div className={textStyles.prose} dangerouslySetInnerHTML={{ __html: html }} />
          {document.updatedAt && <p className={textStyles.updated}>Última atualização: {formatLegalDate(document.updatedAt)}</p>}
          <div className={styles.previewActions}>
            <button className={styles.previewButton} onClick={closePreview} type="button">Entendi</button>
          </div>
        </Modal>
      )}
    </form>
  );
}

export default function LegalEditor(props) {
  const [editing, setEditing] = useState({ source: props.document.html, dirty: false });
  const source = editing.dirty ? editing.source : props.document.html;
  const onDirtyChange = useCallback(dirty => setEditing({ source, dirty }), [source]);
  const extension = useMemo(() => defineExtension({
    name: "LegadoCarLegalDocument",
    namespace: "LegadoCarLegalDocument",
    dependencies: [RichTextExtension, HistoryExtension, ClipboardDOMImportExtension, ListExtension, LinkExtension],
    $initialEditorState: () => {
      const dom = new DOMParser().parseFromString(source, "text/html");
      const nodes = $generateNodesFromDOMViaExtension(dom);
      const root = $getRoot().clear();
      let paragraph = null;
      for (const node of nodes) {
        if ($isElementNode(node) && !node.isInline()) { root.append(node); paragraph = null; }
        else {
          if (!paragraph) { paragraph = $createParagraphNode(); root.append(paragraph); }
          paragraph.append(node);
        }
      }
      if (!root.getChildrenSize()) root.append($createParagraphNode());
    },
    theme: { text: { bold: styles.bold, italic: styles.italic, underline: styles.underline }, link: styles.link },
  }), [source]);
  return <LexicalExtensionComposer contentEditable={null} extension={extension}><EditorSurface {...props} document={{ ...props.document, html: source }} key={source} onDirtyChange={onDirtyChange} /></LexicalExtensionComposer>;
}
