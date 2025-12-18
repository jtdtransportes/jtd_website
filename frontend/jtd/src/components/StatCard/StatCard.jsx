import React from "react";
import "./StatCard.css";
import EnterpriseIcon from "../../assets/icons/enterprise.png";
import LocationIcon from "../../assets/icons/location.png";
import BoxIcon from "../../assets/icons/box.png";
import CarIcon from "../../assets/icons/ca.png";

const cards = [
  {
    id: 1,
    card: EnterpriseIcon,
    info: "+ 12",
    description: "Anos de experiência",
  },

  {
    id: 2,
    card: LocationIcon,
    info: "+ 2874",
    description: "Cargas transportadas",
  },
  {
    id: 3,
    card: BoxIcon,
    info: "+ 126",
    description: "Empresas atendidas",
  },
  {
    id: 4,
    card: CarIcon,
    info: "+ 23.468",
    description: "Kilômetros rodados",
  },
];

const StatCard = () => {
  return (
    <div className="stat-card-container">
      {cards.map((i) => (
        <div className="stat-card" key={i.id}>
          <img src={i.card} alt={i.description} className="stat-icon" />
          <h2>{i.info}</h2>
          <p>{i.description}</p>
        </div>
      ))}
    </div>
  );
};

export default StatCard;
