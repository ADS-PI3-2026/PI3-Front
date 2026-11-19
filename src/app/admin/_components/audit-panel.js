"use client";

import { ClipboardTextIcon } from "@phosphor-icons/react";
import PendingModule from "../_components/pending-module";

export default function AuditPanel() {
  return (
    <PendingModule
      capabilities={[
        "Consultar alterações e exclusões por período.",
        "Identificar a conta responsável e o registro alterado.",
        "Examinar os valores anteriores e posteriores de cada operação.",
      ]}
      description="Consulte a rastreabilidade das operações realizadas na plataforma."
      Icon={ClipboardTextIcon}
      message="A plataforma já registra eventos de auditoria, mas a consulta desses registros pelo painel ainda não está disponível."
      title="Trilha de auditoria"
    />
  );
}
