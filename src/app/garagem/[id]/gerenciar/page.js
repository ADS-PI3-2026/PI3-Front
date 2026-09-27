"use client";

import {
  ArrowRight,
  ArrowsLeftRight,
  CaretRight,
  CheckCircle,
  IdentificationCard,
  Info,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import ActionButton from "../../../components/action-button";
import AppShell from "../../../components/app-shell";
import VehicleBrandLogo from "../../../components/vehicle-brand-logo";
import VehiclePlate from "../../../components/vehicle-plate";
import {
  convertLegacyPlateToMercosul,
  getVehiclePlateType,
} from "../../../lib/vehicle-plate";
import { getVehicleById } from "../../../mock-data";
import PageTopBar from "../../_components/page-top-bar";
import styles from "./page.module.css";

export default function ManageVehiclePage() {
  const params = useParams();
  const vehicle = getVehicleById(params.id);
  const [activeAction, setActiveAction] = useState("");
  const [plateUpdated, setPlateUpdated] = useState(false);

  if (!vehicle) {
    return (
      <AppShell>
        <PageTopBar title="Gerenciar veículo" />
        <section className="app-empty-state app-empty-state--narrow">
          <h2>Veículo não encontrado</h2>
          <p>Volte para a garagem e selecione um veículo cadastrado.</p>
        </section>
      </AppShell>
    );
  }

  const originalPlateType = getVehiclePlateType(vehicle.plate);
  const convertedPlate = convertLegacyPlateToMercosul(vehicle.plate);
  const displayedPlate = plateUpdated ? convertedPlate : vehicle.plate;
  const plateAlreadyMercosul = originalPlateType === "mercosul" || plateUpdated;
  const plateCanBeConverted = Boolean(convertedPlate) && !plateUpdated;

  const confirmPlateChange = () => {
    setPlateUpdated(true);
    setActiveAction("");
  };

  return (
    <AppShell>
      <PageTopBar title="Gerenciar veículo" />

      <main className={styles.managementScreen}>
        <section className={styles.vehicleSummary}>
          <VehicleBrandLogo
            brandId={vehicle.brandId}
            className={styles.brandLogo}
            type={vehicle.type}
          />
          <div className={styles.vehicleName}>
            <h2>{vehicle.name}</h2>
            <p>{vehicle.version}</p>
          </div>
          <VehiclePlate plate={displayedPlate} />
        </section>

        <section aria-labelledby="management-options-title" className={styles.optionsSection}>
          <header className={styles.sectionHeading}>
            <h2 id="management-options-title">Opções do veículo</h2>
            <p>Selecione a operação que deseja realizar.</p>
          </header>

          <div className="app-action-list">
            <Link
              className="app-action-item"
              href={`/garagem/${vehicle.id}/gerenciar/transferencia`}
            >
              <span className="app-action-icon">
                <ArrowsLeftRight aria-hidden size={23} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Transferir veículo</strong>
                <span>Alterar o proprietário responsável pelo veículo.</span>
              </span>
              <CaretRight aria-hidden size={19} weight="bold" />
            </Link>

            <button
              aria-expanded={activeAction === "plate"}
              className={`app-action-item ${activeAction === "plate" ? "app-action-item--active" : ""}`}
              disabled={!plateCanBeConverted}
              onClick={() => setActiveAction("plate")}
              type="button"
            >
              <span className="app-action-icon">
                <IdentificationCard aria-hidden size={24} weight="duotone" />
              </span>
              <span className="app-action-copy">
                <strong>Alteração de placa</strong>
                <span>
                  {plateAlreadyMercosul
                    ? "Este veículo já utiliza o padrão Mercosul."
                    : plateCanBeConverted
                      ? "Converter automaticamente a placa antiga para o padrão Mercosul."
                      : "A placa atual não possui um formato compatível com a conversão."}
                </span>
              </span>
              {plateAlreadyMercosul ? (
                <span className="app-action-status">
                  <CheckCircle aria-hidden size={17} weight="fill" />
                  Atualizada
                </span>
              ) : (
                <CaretRight aria-hidden size={19} weight="bold" />
              )}
            </button>
          </div>
        </section>

        {activeAction === "plate" && plateCanBeConverted && (
          <section className={`app-card ${styles.actionPanel}`}>
            <div className={styles.panelHeading}>
              <span className="app-action-icon">
                <IdentificationCard aria-hidden size={24} weight="duotone" />
              </span>
              <div>
                <h2>Converter para o padrão Mercosul</h2>
                <p>A nova combinação é calculada automaticamente.</p>
              </div>
            </div>

            <div aria-label="Conversão da placa" className={styles.plateComparison}>
              <div className={styles.plateStage}>
                <span>Placa atual</span>
                <VehiclePlate plate={vehicle.plate} />
              </div>
              <ArrowRight aria-hidden className={styles.conversionArrow} size={24} weight="bold" />
              <div className={styles.plateStage}>
                <span>Nova placa</span>
                <VehiclePlate plate={convertedPlate} />
              </div>
            </div>

            <p className="app-feedback app-feedback--info">
              <Info aria-hidden size={18} weight="fill" />
              Apenas o segundo número do bloco numérico é convertido para a letra oficial correspondente.
            </p>

            <ActionButton onClick={confirmPlateChange} type="button">
              Confirmar alteração de placa
            </ActionButton>
          </section>
        )}

        {plateUpdated && (
          <p className="app-feedback app-feedback--success" role="status">
            <CheckCircle aria-hidden size={18} weight="fill" />
            Placa atualizada para {convertedPlate} nesta prévia.
          </p>
        )}
      </main>
    </AppShell>
  );
}
