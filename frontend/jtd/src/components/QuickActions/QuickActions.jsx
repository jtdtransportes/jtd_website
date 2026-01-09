import React from "react";
import "./QuickActions.css";
import CaminhaoLateral from "../../assets/caminhaozinho.png";
import BasketIcon from "../../assets/icons/str.png";
import QuotationIcon from "../../assets/icons/cotations.png";
import SearchIcon from "../../assets/icons/gala_search.png";
import DateTimeIcon from "../../assets/icons/datetime.png";
import Divider from "../Divider/Divider";

const quickItems = [
  { id: 1, icon: BasketIcon, info: "Agendar coleta" },
  { id: 2, icon: QuotationIcon, info: "Cotação" },
  { id: 3, icon: SearchIcon, info: "Rastreamento" },
  { id: 4, icon: DateTimeIcon, info: "Previsão de entrega" },
  { id: 2, icon: QuotationIcon, info: "Cotação" },
  { id: 3, icon: SearchIcon, info: "Rastreamento" },
  { id: 4, icon: DateTimeIcon, info: "Previsão de entrega" },
];

const QuickActions = () => {
  return (
    <>
    <Divider/>
      <div className="quick-actions-container">
        <div className="quick-background-linear"></div>
        <div className="open-section-container">
          <div className="desc-actions-content">
            <p className="desc-actions-text-blue">
              <b>Conheça</b> os nossos
            </p>
            <p className="desc-actions-text-white">
              <b>serviços!</b>
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
