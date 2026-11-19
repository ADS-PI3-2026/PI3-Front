import sanitizeHtml from "sanitize-html";

export function sanitizeLegalHtml(value) {
  return sanitizeHtml(typeof value === "string" ? value : "", {
    allowedTags: ["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "span", "pre", "code"],
    allowedAttributes: { a: ["href", "title", "target", "rel"], ol: ["start"], "*": ["style"] },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], "white-space": [/^pre-wrap$/] } },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener noreferrer" } }),
    },
  });
}

export function hasLegalText(value) {
  const text = sanitizeHtml(sanitizeLegalHtml(value), { allowedTags: [], allowedAttributes: {} });
  return Boolean(text.replace(/&nbsp;|&#160;|&#xa0;/gi, " ").trim());
}

export function formatLegalDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date)
    : "";
}
