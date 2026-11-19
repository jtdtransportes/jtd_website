import React from "react";
import { Link } from "react-router-dom";
import { MdHealthAndSafety } from "react-icons/md";
import "./SafetyHighlight.css";

const SafetyHighlight = () => {
  return (
    <div className="safety-highlight">
      <div className="safety-highlight-card">
        <MdHealthAndSafety className="safety-highlight-icon" aria-hidden="true" />
        <div className="safety-highlight-text">
          <h6>
            Saúde e <b>Segurança do Trabalho</b>
          </h6>
          <p className="safety-highlight-quote">
            "Nenhuma entrega é mais importante do que a vida. Segurança é
            responsabilidade de todos."
          </p>
          <p className="safety-highlight-desc">
            Conheça a política que orienta a prevenção de acidentes, a saúde
            ocupacional e a segurança nas nossas operações de transporte.
          </p>
        </div>
        <Link to="/saude-seguranca" className="safety-highlight-button">
          Ler a política
        </Link>
      </div>
    </div>
  );
};

export default SafetyHighlight;
