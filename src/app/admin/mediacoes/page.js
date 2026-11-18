"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import PendingModule from "../_components/pending-module";

export default function MediationsPage() {
  return (
    <PendingModule
      capabilities={[
        "Localizar transferências por veículo e situação.",
        "Consultar as partes envolvidas, os prazos e as confirmações.",
        "Acompanhar solicitações que precisam de intervenção administrativa.",
      ]}
      description="Acompanhe as transferências de histórico que precisam de atenção da equipe."
      Icon={ArrowsLeftRightIcon}
      message="O acompanhamento de transferências pela equipe administrativa ainda não está disponível. As transferências continuam acessíveis aos envolvidos pelo aplicativo."
      title="Mediações técnicas"
    />
  );
}
