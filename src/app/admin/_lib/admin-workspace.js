export const adminTabs = [
  { id: "administradores", label: "Administradores" },
  { id: "usuarios", label: "Usuários" },
  { id: "veiculos", label: "Veículos" },
  { id: "servicos", label: "Tipos de serviço" },
  { id: "textos", label: "Textos legais" },
  { id: "mediacoes", label: "Mediações" },
  { id: "auditoria", label: "Auditoria" },
];

export function resolveAdminTab(value) {
  return adminTabs.some(({ id }) => id === value) ? value : "administradores";
}

export function nextAdminTab(current, key) {
  const index = adminTabs.findIndex(({ id }) => id === current);
  if (key === "Home") return adminTabs[0].id;
  if (key === "End") return adminTabs.at(-1).id;
  if (!["ArrowLeft", "ArrowRight"].includes(key)) return null;
  return adminTabs[(index + (key === "ArrowRight" ? 1 : -1) + adminTabs.length) % adminTabs.length].id;
}

export function adminWorkspaceHref(tab, { status, novo } = {}) {
  const selected = resolveAdminTab(tab);
  const query = new URLSearchParams({ aba: selected });
  if (selected === "servicos") {
    if (["0", "1"].includes(status)) query.set("status", status);
    if (novo === "1") query.set("novo", "1");
  }
  return `/admin?${query}`;
}

export function readAdminPage(value) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function updateAdminWorkspaceHref(current, updates) {
  const query = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  if (Object.hasOwn(updates, "status")) query.delete("pagina-servicos");
  query.set("aba", resolveAdminTab(query.get("aba")));
  return `/admin?${query}`;
}
