import React from "react";
import "./QuickActions.css";
import CaminhaoLateral from "../../assets/caminhaozinho.png";
import CargasLotacaoIcon from "../../assets/icons/cargaslotacao.png";
import DistributionIcon from "../../assets/icons/distribution.png";
import ArmazenagemIcon from "../../assets/icons/storage.png";
import CrossDockingIcon from "../../assets/icons/crossdocking.png";
import PalletIcon from "../../assets/icons/pallet.png";
import LogisticIcon from "../../assets/icons/logistica.png";

import Divider from "../Divider/Divider";

const quickItems = [
  { id: 1, icon: CargasLotacaoIcon, info: "Cargas Lotação" },
  { id: 2, icon: DistributionIcon, info: "Distribuição" },
  { id: 3, icon: ArmazenagemIcon, info: "Armazenagem" },
  { id: 4, icon: CrossDockingIcon, info: "Cross-docking" },
  { id: 5, icon: PalletIcon, info: "Paletização" },
  { id: 6, icon: LogisticIcon, info: "Operador Logístico" },
];

const QuickActions = () => {
  return (
    <>
      <Divider />
      <div className="quick-actions-container">
        <div className="quick-background-linear"></div>
        <div className="open-section-container">
          <div className="desc-actions-content">
            <p className="desc-actions-text-blue">
              <b>Conheça</b> os nossos
              <span className="mobile-break">
                <br />
              </span>
              <span className="services-desc-actions"> serviços!</span>
            </p>
          </div>
          <div className="img-caminhao-content">
            <img
              src={CaminhaoLateral}
              alt="Caminhao branco de lado no canto direito da imagem."
            />
          </div>
        </div>
        <div className="actions-map-container">
          {quickItems.map((item) => (
            <div className="action-item" key={item.id}>
              <img src={item.icon} alt={item.info} />
              <p>{item.info}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default QuickActions;
