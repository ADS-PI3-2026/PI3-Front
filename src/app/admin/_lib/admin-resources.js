export function resourceList(data) {
  const items = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(items)) throw new Error("O serviço retornou uma resposta inesperada. Tente novamente.");
  return items;
}

export function resourcePage(data) {
  const items = resourceList(data);
  return {
    items,
    page: Number(data?.meta?.current_page) || 1,
    lastPage: Number(data?.meta?.last_page) || 1,
    total: Number.isFinite(Number(data?.meta?.total)) ? Number(data.meta.total) : items.length,
  };
}

export function numericId(id) {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1) throw new Error("Registro inválido.");
  return value;
}
